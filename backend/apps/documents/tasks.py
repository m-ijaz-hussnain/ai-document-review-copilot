"""Idempotent processing pipeline with explicit status transitions."""
import os

from celery import shared_task
from django.conf import settings


@shared_task(bind=True, max_retries=2, default_retry_delay=5)
def process_document(self, document_id, file_bytes_hex=None):
    from apps.documents.models import Document, DocumentChunk, DocumentVersion
    from services.chunking import chunk_pages
    from services.embeddings import get_embedding_provider
    from services.extraction import extract_text
    try:
        doc = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        return {"status": "missing"}
    # Idempotency: already completed with chunks -> no-op
    if doc.status == Document.Status.COMPLETED and doc.chunks.exists():
        return {"status": "already_completed"}
    try:
        # bytes: prefer stored private file, fall back to hex payload (tests/eager)
        data = None
        path = os.path.join(str(settings.MEDIA_ROOT), doc.storage_id)
        if os.path.exists(path):
            with open(path, "rb") as fh: data = fh.read()
        elif file_bytes_hex:
            data = bytes.fromhex(file_bytes_hex)
        if data is None: raise ValueError("Stored file not found for document.")
        doc.status = Document.Status.EXTRACTING; doc.save(update_fields=["status"])
        pages = extract_text(data, doc.file_type)
        if len(pages) > settings.MAX_PAGES: raise ValueError(f"Page count {len(pages)} exceeds limit {settings.MAX_PAGES}.")
        doc.page_count = len(pages)
        doc.status = Document.Status.INDEXING; doc.save(update_fields=["status","page_count"])
        pieces = chunk_pages(pages)
        provider = get_embedding_provider()
        # Re-index safely: clear prior partial chunks on retry
        DocumentChunk.objects.filter(document=doc).delete()
        for i, piece in enumerate(pieces):
            DocumentChunk.objects.create(document=doc, chunk_index=i, page_number=piece["page_number"], text=piece["text"], embedding=provider.embed(piece["text"]))
        DocumentVersion.objects.get_or_create(document=doc, version=1)
        doc.status = Document.Status.COMPLETED; doc.error_message = ""; doc.save(update_fields=["status","error_message"])
        return {"status": "completed", "chunks": len(pieces)}
    except Exception as exc:
        doc.status = Document.Status.FAILED; doc.error_message = str(exc)[:1000]; doc.save(update_fields=["status","error_message"])
        return {"status": "failed", "error": str(exc)}

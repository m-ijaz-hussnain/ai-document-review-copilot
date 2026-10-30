from django.conf import settings


def chunk_pages(pages, chunk_size=None, overlap=None):
    chunk_size = chunk_size or settings.CHUNK_SIZE
    overlap = overlap or settings.CHUNK_OVERLAP
    chunks = []
    for page_number, text in pages:
        text = " ".join(text.split())
        start = 0
        while start < len(text):
            piece = text[start:start+chunk_size]
            if piece.strip(): chunks.append({"page_number": page_number, "text": piece})
            if start + chunk_size >= len(text): break
            start += max(1, chunk_size - overlap)
    return chunks

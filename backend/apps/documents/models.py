import uuid

from django.conf import settings
from django.db import models


class Document(models.Model):
    class Status(models.TextChoices):
        UPLOADED="uploaded","Uploaded"; QUEUED="queued","Queued"; EXTRACTING="extracting","Extracting"
        INDEXING="indexing","Indexing"; REVIEWING="reviewing","Reviewing"; COMPLETED="completed","Completed"; FAILED="failed","Failed"
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="documents")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=300)
    original_filename = models.CharField(max_length=300)
    storage_id = models.CharField(max_length=100, unique=True, default=uuid.uuid4)
    file_type = models.CharField(max_length=10)
    size_bytes = models.PositiveIntegerField(default=0)
    page_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPLOADED)
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True); updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization","status"]), models.Index(fields=["owner"])]
class DocumentVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="versions")
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta: constraints = [models.UniqueConstraint(fields=["document","version"], name="uniq_doc_version")]
class DocumentChunk(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    chunk_index = models.PositiveIntegerField()
    page_number = models.PositiveIntegerField(default=1)
    text = models.TextField()
    embedding = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["chunk_index"]
        indexes = [models.Index(fields=["document","page_number"])]
        constraints = [models.UniqueConstraint(fields=["document","chunk_index"], name="uniq_chunk_idx")]

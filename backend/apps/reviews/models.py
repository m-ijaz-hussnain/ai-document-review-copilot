import uuid

from django.conf import settings
from django.db import models


class ReviewJob(models.Model):
    class Status(models.TextChoices):
        QUEUED="queued","Queued"; RUNNING="running","Running"; COMPLETED="completed","Completed"; FAILED="failed","Failed"
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey("documents.Document", on_delete=models.CASCADE, related_name="review_jobs")
    policy_version = models.ForeignKey("policies.ReviewPolicyVersion", on_delete=models.PROTECT, related_name="review_jobs")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True); updated_at = models.DateTimeField(auto_now=True)
    class Meta: ordering = ["-created_at"]
class AIReviewResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.OneToOneField(ReviewJob, on_delete=models.CASCADE, related_name="result")
    summary = models.TextField(blank=True, default="")
    raw_output = models.JSONField(default=dict)
    model_id = models.CharField(max_length=200, blank=True, default="")
    prompt_version = models.CharField(max_length=50, blank=True, default="")
    schema_version = models.CharField(max_length=20, default="1.0")
    latency_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
class Finding(models.Model):
    class Status(models.TextChoices):
        PENDING="pending","Pending"; APPROVED="approved","Approved"; REJECTED="rejected","Rejected"; ESCALATED="escalated","Escalated"; EDITED="edited","Edited"
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    result = models.ForeignKey(AIReviewResult, on_delete=models.CASCADE, related_name="findings")
    title = models.CharField(max_length=300); description = models.TextField()
    category = models.CharField(max_length=50, default="general_observation")
    severity = models.CharField(max_length=20, default="low")
    confidence = models.FloatField(default=0.5)
    reasoning_summary = models.TextField(blank=True, default=""); recommended_action = models.TextField(blank=True, default="")
    requires_human_review = models.BooleanField(default=True)
    priority_score = models.PositiveIntegerField(default=10)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True); updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ["-priority_score","-created_at"]
        indexes = [models.Index(fields=["severity","status"])]
class EvidenceReference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    finding = models.ForeignKey(Finding, on_delete=models.CASCADE, related_name="evidence")
    chunk = models.ForeignKey("documents.DocumentChunk", on_delete=models.PROTECT, related_name="evidence_refs")
    page_number = models.PositiveIntegerField(default=1); quoted_text = models.TextField()
class HumanReviewDecision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    finding = models.ForeignKey(Finding, on_delete=models.CASCADE, related_name="decisions")
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    decision = models.CharField(max_length=20)
    comment = models.TextField(blank=True, default="")
    edited_title = models.CharField(max_length=300, blank=True, default="")
    edited_description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta: ordering = ["-created_at"]

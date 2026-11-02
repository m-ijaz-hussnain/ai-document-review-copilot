import uuid

from django.db import models


class EvaluationRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dataset_version = models.CharField(max_length=50, default="1.0")
    config = models.JSONField(default=dict, blank=True)
    metrics = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta: ordering = ["-created_at"]
class EvaluationCase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(EvaluationRun, on_delete=models.CASCADE, related_name="cases", null=True, blank=True)
    case_id = models.CharField(max_length=100)
    document_text = models.TextField(); expected_categories = models.JSONField(default=list, blank=True)
    predicted_categories = models.JSONField(default=list, blank=True)
    passed = models.BooleanField(default=False)
    details = models.JSONField(default=dict, blank=True)

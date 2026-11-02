import uuid

from django.conf import settings
from django.db import models


class ModelUsageRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="usage_records", null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    provider = models.CharField(max_length=50, default="mock"); model_id = models.CharField(max_length=200, blank=True, default="")
    input_tokens = models.PositiveIntegerField(default=0); output_tokens = models.PositiveIntegerField(default=0)
    latency_ms = models.PositiveIntegerField(default=0)
    estimated_cost_usd = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

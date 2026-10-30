import uuid

from django.conf import settings
from django.db import models


class ReviewPolicy(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("accounts.Organization", on_delete=models.CASCADE, related_name="policies")
    name = models.CharField(max_length=200); description = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True); updated_at = models.DateTimeField(auto_now=True)
    class Meta: ordering = ["name"]
class ReviewPolicyVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    policy = models.ForeignKey(ReviewPolicy, on_delete=models.CASCADE, related_name="versions")
    version = models.CharField(max_length=20, default="1.0")
    rules = models.JSONField(default=dict, blank=True)
    checklist = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta: constraints = [models.UniqueConstraint(fields=["policy","version"], name="uniq_policy_version")]

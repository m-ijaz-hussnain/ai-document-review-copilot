import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def __str__(self): return self.name
class User(AbstractUser):
    class Roles(models.TextChoices):
        ADMIN = "admin", "Administrator"
        REVIEWER = "reviewer", "Reviewer"
        UPLOADER = "uploader", "Uploader"
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="users", null=True, blank=True)
    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.UPLOADER)
    class Meta:
        indexes = [models.Index(fields=["organization", "role"])]

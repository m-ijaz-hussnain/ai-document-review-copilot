from rest_framework import serializers

from .models import AuditEvent


class AuditSerializer(serializers.ModelSerializer):
    class Meta: model = AuditEvent; fields = ["id","actor","action","object_type","object_id","metadata","created_at"]

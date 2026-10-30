from rest_framework import serializers

from .models import ReviewPolicy, ReviewPolicyVersion


class VersionSerializer(serializers.ModelSerializer):
    class Meta: model = ReviewPolicyVersion; fields = ["id","policy","version","rules","checklist","created_at"]
class PolicySerializer(serializers.ModelSerializer):
    versions = VersionSerializer(many=True, read_only=True)
    class Meta: model = ReviewPolicy; fields = ["id","name","description","created_by","versions","created_at","updated_at"]

from rest_framework import serializers

from .models import Organization, User


class OrgSerializer(serializers.ModelSerializer):
    class Meta: model = Organization; fields = ["id","name","slug","created_at"]
class UserSerializer(serializers.ModelSerializer):
    organization_name = serializers.SerializerMethodField()
    class Meta: model = User; fields = ["id","username","email","first_name","last_name","role","organization","organization_name","is_active","date_joined"]
    def get_organization_name(self, obj): return obj.organization.name if obj.organization else None
class ProfileUpdateSerializer(serializers.ModelSerializer):
    # Email is intentionally NOT a field here: a PATCH /auth/me/ payload
    # containing "email" is ignored, never applied.
    class Meta: model = User; fields = ["username","first_name","last_name"]

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdmin
from services.audit import record

from .models import ReviewPolicy, ReviewPolicyVersion
from .serializers import PolicySerializer, VersionSerializer


class PolicyViewSet(viewsets.ModelViewSet):
    serializer_class = PolicySerializer
    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "add_version"):
            return [IsAdmin()]
        return [IsAuthenticated()]
    def get_queryset(self): return ReviewPolicy.objects.filter(organization=self.request.user.organization).order_by("-created_at")
    def perform_create(self, serializer):
        policy = serializer.save(organization=self.request.user.organization, created_by=self.request.user)
        ReviewPolicyVersion.objects.create(policy=policy, version=self.request.data.get("version","1.0"),
            rules=self.request.data.get("rules",{}), checklist=self.request.data.get("checklist",[]))
        record(policy.organization, self.request.user, "policy.create", "ReviewPolicy", policy.id)
    @action(detail=True, methods=["post"])
    def add_version(self, request, pk=None):
        policy = self.get_object()
        v = ReviewPolicyVersion.objects.create(policy=policy, version=request.data.get("version","1.1"), rules=request.data.get("rules",{}), checklist=request.data.get("checklist",[]))
        record(policy.organization, request.user, "policy.version", "ReviewPolicy", policy.id)
        return Response(VersionSerializer(v).data, status=201)

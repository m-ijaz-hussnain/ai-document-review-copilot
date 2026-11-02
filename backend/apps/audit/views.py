from rest_framework import viewsets

from .models import AuditEvent
from .serializers import AuditSerializer


class AuditViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditSerializer
    def get_queryset(self): return AuditEvent.objects.filter(organization=self.request.user.organization)

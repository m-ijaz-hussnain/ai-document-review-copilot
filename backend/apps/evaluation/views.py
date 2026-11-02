from rest_framework import serializers, viewsets

from apps.accounts.permissions import IsAdmin

from .models import EvaluationRun


class RunSerializer(serializers.ModelSerializer):
    class Meta: model = EvaluationRun; fields = ["id","dataset_version","config","metrics","created_at"]
class EvalViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RunSerializer; queryset = EvaluationRun.objects.all()
    permission_classes = [IsAdmin]

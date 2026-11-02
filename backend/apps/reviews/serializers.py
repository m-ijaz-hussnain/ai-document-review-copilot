from rest_framework import serializers

from .models import AIReviewResult, EvidenceReference, Finding, HumanReviewDecision, ReviewJob


class EvidenceSerializer(serializers.ModelSerializer):
    document_chunk_id = serializers.UUIDField(source="chunk_id", read_only=True)
    class Meta: model = EvidenceReference; fields = ["id","document_chunk_id","page_number","quoted_text"]
class DecisionSerializer(serializers.ModelSerializer):
    class Meta: model = HumanReviewDecision; fields = ["id","decision","comment","edited_title","edited_description","reviewer","created_at"]
class FindingSerializer(serializers.ModelSerializer):
    evidence = EvidenceSerializer(many=True, read_only=True)
    decisions = DecisionSerializer(many=True, read_only=True)
    class Meta: model = Finding; fields = ["id","title","description","category","severity","confidence","reasoning_summary","recommended_action","requires_human_review","priority_score","status","evidence","decisions","created_at"]
class ResultSerializer(serializers.ModelSerializer):
    findings = FindingSerializer(many=True, read_only=True)
    class Meta: model = AIReviewResult; fields = ["id","summary","model_id","prompt_version","schema_version","latency_ms","findings","created_at"]
class JobSerializer(serializers.ModelSerializer):
    result = ResultSerializer(read_only=True)
    class Meta: model = ReviewJob; fields = ["id","document","policy_version","status","error_message","result","created_by","created_at"]

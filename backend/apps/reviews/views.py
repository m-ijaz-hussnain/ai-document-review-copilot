from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.documents.models import Document
from apps.policies.models import ReviewPolicyVersion
from services.audit import record

from .models import Finding, HumanReviewDecision, ReviewJob
from .serializers import FindingSerializer, JobSerializer
from .tasks import run_review_task


class ReviewViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = JobSerializer
    def get_queryset(self): return ReviewJob.objects.filter(document__organization=self.request.user.organization)

class FindingViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FindingSerializer
    def get_queryset(self):
        qs = Finding.objects.filter(result__job__document__organization=self.request.user.organization)
        for key in ("severity","category","status"):
            v = self.request.query_params.get(key)
            if v: qs = qs.filter(**{key: v})
        return qs.order_by("-created_at")
    def _decide(self, request, decision):
        if request.user.role not in ("admin","reviewer"):
            return Response({"error":{"code":403,"message":"Only reviewers or admins can record decisions","details":None}}, status=403)
        finding = self.get_object()
        d = HumanReviewDecision.objects.create(finding=finding, reviewer=request.user, decision=decision,
            comment=request.data.get("comment",""), edited_title=request.data.get("edited_title",""), edited_description=request.data.get("edited_description",""))
        status_map = {"approve":"approved","reject":"rejected","escalate":"escalated","edit":"edited"}
        finding.status = status_map[decision]
        if decision == "edit":
            if d.edited_title: finding.title = d.edited_title
            if d.edited_description: finding.description = d.edited_description
        finding.save(update_fields=["status","title","description"])
        record(finding.result.job.document.organization, request.user, f"finding.{decision}", "Finding", finding.id)
        return Response(FindingSerializer(finding).data)
    @action(detail=True, methods=["post"]) 
    def approve(self, request, pk=None): return self._decide(request, "approve")
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None): return self._decide(request, "reject")
    @action(detail=True, methods=["post"])
    def escalate(self, request, pk=None): return self._decide(request, "escalate")
    @action(detail=True, methods=["post"])
    def edit(self, request, pk=None): return self._decide(request, "edit")

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_review(request, document_id):
    if request.user.role not in ("admin","reviewer"):
        return Response({"error":{"code":403,"message":"Only reviewers or admins can start a review","details":None}}, status=403)
    try: doc = Document.objects.get(id=document_id, organization=request.user.organization)
    except Document.DoesNotExist: return Response({"error":{"code":404,"message":"Document not found","details":None}}, status=404)
    pv_id = request.data.get("policy_version_id") or request.data.get("policy_version")
    try: pv = ReviewPolicyVersion.objects.get(id=pv_id, policy__organization=request.user.organization)
    except (ReviewPolicyVersion.DoesNotExist, Exception): return Response({"error":{"code":400,"message":"Valid policy_version_id for your organization is required","details":None}}, status=400)
    if doc.status != Document.Status.COMPLETED:
        return Response({"error":{"code":400,"message":f"Document is not ready (status={doc.status})","details":None}}, status=400)
    existing = ReviewJob.objects.filter(document=doc, policy_version=pv, status__in=["queued","running"]).first()
    if existing: return Response(JobSerializer(existing).data, status=200)
    job = ReviewJob.objects.create(document=doc, policy_version=pv, created_by=request.user)
    record(request.user.organization, request.user, "review.create", "ReviewJob", job.id)
    run_review_task.delay(str(job.id))
    job.refresh_from_db()
    return Response(JobSerializer(job).data, status=201)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    from apps.documents.models import Document
    org = request.user.organization
    docs = Document.objects.filter(organization=org)
    return Response({
        "total_documents": docs.count(),
        "awaiting_review": Finding.objects.filter(result__job__document__organization=org, status="pending").count(),
        "processing_failures": docs.filter(status="failed").count(),
        "completed": docs.filter(status="completed").count(),
        "total_findings": Finding.objects.filter(result__job__document__organization=org).count(),
    })

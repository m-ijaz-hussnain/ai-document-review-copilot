import os
import uuid

from django.conf import settings
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from services.audit import record
from services.extraction import detect_type, validate_magic

from .models import Document
from .serializers import ChunkSerializer, DocumentSerializer
from .tasks import process_document


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "upload"
    def get_queryset(self):
        qs = Document.objects.filter(organization=self.request.user.organization)
        q = self.request.query_params.get("search")
        if q: qs = qs.filter(title__icontains=q)
        s = self.request.query_params.get("status")
        if s: qs = qs.filter(status=s)
        return qs
    def create(self, request, *args, **kwargs):
        f = request.FILES.get("file")
        if not f: return Response({"error":{"code":400,"message":"No file provided (field: file)","details":None}}, status=400)
        if not request.user.organization: return Response({"error":{"code":400,"message":"User has no organization","details":None}}, status=400)
        ftype = detect_type(f.name)
        if not ftype: return Response({"error":{"code":400,"message":"Unsupported file type. Allowed: PDF, DOCX, TXT","details":None}}, status=400)
        if f.size > settings.MAX_UPLOAD_MB*1024*1024: return Response({"error":{"code":400,"message":f"File exceeds {settings.MAX_UPLOAD_MB} MB limit","details":None}}, status=400)
        data = f.read()
        try: validate_magic(data, ftype)
        except ValueError as e: return Response({"error":{"code":400,"message":str(e),"details":None}}, status=400)
        storage_id = str(uuid.uuid4())
        os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
        with open(os.path.join(str(settings.MEDIA_ROOT), storage_id), "wb") as out: out.write(data)
        doc = Document.objects.create(organization=request.user.organization, owner=request.user,
            title=request.data.get("title") or f.name, original_filename=f.name, storage_id=storage_id,
            file_type=ftype, size_bytes=f.size, status=Document.Status.QUEUED)
        record(request.user.organization, request.user, "document.upload", "Document", doc.id)
        process_document.delay(str(doc.id))
        return Response(DocumentSerializer(doc).data, status=201)
    @action(detail=True, methods=["get"])
    def chunks(self, request, pk=None):
        doc = self.get_object()
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination(); paginator.page_size = 50
        page = paginator.paginate_queryset(doc.chunks.all(), request)
        return paginator.get_paginated_response(ChunkSerializer(page, many=True).data)
    @action(detail=True, methods=["post"])
    def reprocess(self, request, pk=None):
        doc = self.get_object(); doc.status = Document.Status.QUEUED; doc.save(update_fields=["status"])
        process_document.delay(str(doc.id)); return Response(DocumentSerializer(doc).data)
    def perform_destroy(self, instance):
        record(instance.organization, self.request.user, "document.delete", "Document", instance.id)
        path = os.path.join(str(settings.MEDIA_ROOT), instance.storage_id)
        if os.path.exists(path): os.remove(path)
        instance.delete()

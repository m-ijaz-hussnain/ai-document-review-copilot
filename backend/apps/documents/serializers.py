from rest_framework import serializers

from .models import Document, DocumentChunk


class ChunkSerializer(serializers.ModelSerializer):
    class Meta: model = DocumentChunk; fields = ["id","chunk_index","page_number","text"]
class DocumentSerializer(serializers.ModelSerializer):
    chunk_count = serializers.SerializerMethodField()
    class Meta: model = Document; fields = ["id","title","original_filename","file_type","size_bytes","page_count","status","error_message","owner","organization","created_at","updated_at","chunk_count"]
    def get_chunk_count(self, obj): return obj.chunks.count()

"""Embedding providers. Local provider is deterministic (hash-based) for tests/demo with NO external calls.
Bedrock embedding path uses the same interface; operator must configure a valid embedding model ID."""
import hashlib
import math

from django.conf import settings


def _local_embed(text, dim=None):
    dim = dim or settings.EMBEDDING_DIM
    vec = [0.0]*dim
    for tok in text.lower().split():
        h = int(hashlib.sha256(tok.encode()).hexdigest()[:8], 16)
        vec[h % dim] += 1.0
    n = math.sqrt(sum(x*x for x in vec)) or 1.0
    return [x/n for x in vec]

def cosine(a, b):
    if not a or not b: return 0.0
    return sum(x*y for x, y in zip(a, b))

class LocalEmbeddingProvider:
    name = "local"
    def embed(self, text): return _local_embed(text)

class BedrockEmbeddingProvider:
    name = "bedrock"
    def embed(self, text):
        if not settings.EMBEDDING_MODEL_ID:
            raise RuntimeError("EMBEDDING_MODEL_ID is not configured. Set a Bedrock embedding model ID you have access to, or use EMBEDDING_PROVIDER=local.")
        import json as _j

        import boto3
        client = boto3.client("bedrock-runtime", region_name=settings.BEDROCK_REGION)
        resp = client.invoke_model(modelId=settings.EMBEDDING_MODEL_ID, body=_j.dumps({"inputText": text}))
        import json as jj
        body = jj.loads(resp["body"].read())
        return body["embedding"]

def get_embedding_provider():
    return BedrockEmbeddingProvider() if settings.EMBEDDING_PROVIDER == "bedrock" else LocalEmbeddingProvider()

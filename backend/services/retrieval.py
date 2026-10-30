"""Hybrid retrieval: keyword overlap + vector cosine, tenant-filtered at the queryset level by callers.
For PostgreSQL+pgvector in production, replace the Python cosine pass with a pgvector <=> query (see docs/architecture.md)."""
from services.embeddings import cosine, get_embedding_provider


def hybrid_search(chunks_qs, query, top_k=5):
    provider = get_embedding_provider()
    qemb = provider.embed(query)
    qwords = set(query.lower().split())
    scored = []
    for ch in chunks_qs:
        words = set(ch.text.lower().split())
        kw = len(qwords & words) / max(1, len(qwords))
        vec = cosine(qemb, ch.embedding or [])
        score = 0.5*kw + 0.5*vec
        scored.append((score, ch))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:top_k]]

"""Review engine: retrieval -> rules + LLM -> Pydantic validation -> citation validation -> persistence.
Idempotent per ReviewJob: if a result already exists it is returned, not duplicated."""
import time

from django.conf import settings
from pydantic import ValidationError

from services.llm import ProviderError, get_provider
from services.prompts import PROMPT_VERSION
from services.rules import needs_human_review, priority_score
from services.schemas import SCHEMA_VERSION, ReviewOutput
from services.validation import validate_citations


def run_review(job):
    from apps.reviews.models import AIReviewResult, EvidenceReference, Finding
    from apps.usage.models import ModelUsageRecord
    if hasattr(job, "result"):
        return job.result
    doc = job.document
    pv = job.policy_version
    rule_list = []
    if isinstance(pv.rules, dict):
        for phrase in pv.rules.get("requires_phrases", []): rule_list.append(f"REQUIRES: {phrase}")
    elif isinstance(pv.rules, list): rule_list = pv.rules
    chunks = list(doc.chunks.all()[:20])
    chunk_payload = [{"id": str(c.id), "page_number": c.page_number, "text": c.text} for c in chunks]
    chunk_map = {str(c.id): c for c in chunks}
    provider = get_provider()
    start = time.time()
    try:
        raw, meta = provider.review(str(doc.id), doc.title, chunk_payload, rule_list, policy_id=str(pv.policy_id), policy_version=pv.version)
    except ProviderError:
        raise
    latency = meta.get("latency_ms", int((time.time()-start)*1000))
    # Server owns document_id — never trust model's
    raw["document_id"] = str(doc.id)
    try:
        parsed = ReviewOutput.model_validate(raw)
    except ValidationError as e:
        raise ValueError(f"AI output failed schema validation: {e.errors()[:3]}") from e
    data = parsed.model_dump()
    ok, errors = validate_citations(data, chunk_map)
    if not ok:
        raise ValueError(f"Citation validation failed: {errors[:3]}")
    result = AIReviewResult.objects.create(job=job, summary=data["summary"], raw_output=data,
        model_id=getattr(provider, "model_id", provider.name), prompt_version=PROMPT_VERSION, schema_version=SCHEMA_VERSION, latency_ms=latency)
    for f in data["findings"]:
        f["requires_human_review"] = needs_human_review(f)
        finding = Finding.objects.create(result=result, title=f["title"], description=f["description"],
            category=f["category"], severity=f["severity"], confidence=f["confidence"],
            reasoning_summary=f["reasoning_summary"], recommended_action=f["recommended_action"],
            requires_human_review=f["requires_human_review"], priority_score=priority_score(f))
        for ev in f.get("evidence", []):
            EvidenceReference.objects.create(finding=finding, chunk=chunk_map[str(ev["document_chunk_id"])],
                page_number=ev["page_number"], quoted_text=ev["quoted_text"])
    total_tokens = meta.get("input_tokens",0)+meta.get("output_tokens",0)
    ModelUsageRecord.objects.create(organization=doc.organization, user=job.created_by, provider=provider.name,
        model_id=getattr(provider,"model_id",""), input_tokens=meta.get("input_tokens",0), output_tokens=meta.get("output_tokens",0),
        latency_ms=latency, estimated_cost_usd=round(total_tokens/1000*settings.COST_PER_1K_TOKENS_USD, 6))
    return result

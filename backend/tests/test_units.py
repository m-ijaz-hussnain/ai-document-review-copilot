import pytest
from pydantic import ValidationError

from services.chunking import chunk_pages
from services.evaluation import compute_metrics, recall_at_k
from services.schemas import ReviewOutput
from services.validation import validate_citations


def test_schema_rejects_bad_severity():
    with pytest.raises(ValidationError):
        ReviewOutput.model_validate({"document_id":"1","review_status":"completed","summary":"s","findings":[{"finding_id":"f","title":"t","description":"d","category":"risk","severity":"extreme","confidence":0.5,"reasoning_summary":"r","recommended_action":"a","requires_human_review":True}]})

def test_schema_rejects_extra_fields():
    with pytest.raises(ValidationError):
        ReviewOutput.model_validate({"document_id":"1","review_status":"completed","summary":"s","findings":[],"surprise":1})

def test_citation_rejects_invented_chunk():
    class C: page_number=1; text="hello world"
    ok, errs = validate_citations({"findings":[{"finding_id":"f1","evidence":[{"document_chunk_id":"nope","page_number":1,"quoted_text":"hello"}]}]}, {"real": C()})
    assert not ok and errs

def test_citation_accepts_real_quote():
    class C: page_number=1; text="hello world policy"
    ok, errs = validate_citations({"findings":[{"finding_id":"f1","evidence":[{"document_chunk_id":"real","page_number":1,"quoted_text":"hello world"}]}]}, {"real": C()})
    assert ok, errs

def test_metrics_math():
    m = compute_metrics([{"expected":["a"],"predicted":["a"],"citation_total":1,"citation_ok":1},{"expected":["a"],"predicted":[],"citation_total":0,"citation_ok":0}])
    assert m["precision"] == 1.0 and m["recall"] == 0.5 and m["tp"] == 1 and m["fn"] == 1

def test_recall_at_k():
    assert recall_at_k(["a","b"], ["a","x","b"], k=2) == 0.5

def test_chunking_preserves_pages():
    chunks = chunk_pages([(2, "word "*300)], chunk_size=100, overlap=10)
    assert chunks and all(c["page_number"] == 2 for c in chunks)

def test_malformed_ai_output_rejected():
    # Mock always returns valid output; malformed dict must fail schema
    with pytest.raises(ValidationError):
        ReviewOutput.model_validate({"document_id":"1","review_status":"done","summary":1,"findings":"nope"})

@pytest.mark.django_db
def test_bedrock_unconfigured_fails_clearly(settings):
    settings.AI_PROVIDER = "bedrock"; settings.BEDROCK_MODEL_ID = ""
    from services.llm import BedrockProvider, ProviderError
    with pytest.raises(ProviderError): BedrockProvider()

def test_priority_rules_documented():
    from services.rules import needs_human_review, priority_score
    assert priority_score({"severity":"critical","evidence":[],"confidence":0.1}) == 100
    assert needs_human_review({"severity":"low","evidence":[{"x":1}],"confidence":0.9,"requires_human_review":False}) is False
    assert needs_human_review({"severity":"high","evidence":[{"x":1}],"confidence":0.9}) is True

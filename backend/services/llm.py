"""Provider abstraction. MockProvider is deterministic and is the default for tests/demo (no AWS needed).
BedrockProvider uses boto3 converse/invoke; model ID + region come from env and access must be granted in the AWS account."""
import json
import time

from django.conf import settings

from services.prompts import SYSTEM_PROMPT, build_user_prompt


class ProviderError(Exception): pass

class MockProvider:
    name = "mock"
    model_id = "mock-v1"
    def review(self, document_id, title, chunks, policy_rules, policy_id="", policy_version=""):
        findings = []
        joined = " ".join(c["text"].lower() for c in chunks)
        # Deterministic: flag missing required phrases declared in rules like "REQUIRES: <phrase>"
        idx = 0
        for rule in policy_rules:
            if isinstance(rule, str) and rule.startswith("REQUIRES:"):
                phrase = rule.split(":",1)[1].strip()
                if phrase.lower() not in joined and chunks:
                    idx += 1
                    c = chunks[0]
                    findings.append({
                        "finding_id": f"mock-{idx}", "title": f"Possibly missing: {phrase}",
                        "description": f"The required element '{phrase}' was not found in the retrieved passages.",
                        "category": "missing_clause", "severity": "high", "confidence": 0.6,
                        "evidence": [{"document_chunk_id": str(c["id"]), "page_number": c["page_number"], "quoted_text": c["text"][:200]}],
                        "policy_references": [{"policy_id": str(policy_id), "policy_version": str(policy_version), "section_id": "rule"}] if policy_id else [],
                        "reasoning_summary": "Keyword/rule check did not locate the required element in extracted text.",
                        "recommended_action": "Reviewer to verify whether the element exists elsewhere or must be added.",
                        "requires_human_review": True})
        if not findings:
            findings.append({
                "finding_id": "mock-ok-1", "title": "No deterministic issues detected",
                "description": "Mock review found no missing required elements. This is not a guarantee of compliance.",
                "category": "general_observation", "severity": "low", "confidence": 0.5,
                "evidence": [{"document_chunk_id": str(chunks[0]["id"]), "page_number": chunks[0]["page_number"], "quoted_text": chunks[0]["text"][:200]}] if chunks else [],
                "policy_references": [], "reasoning_summary": "Deterministic mock checks passed on retrieved passages.",
                "recommended_action": "Human reviewer to perform substantive review.", "requires_human_review": True})
        return {"document_id": str(document_id), "review_status": "completed",
                "summary": f"Mock review completed with {len(findings)} finding(s). Human review required.", "findings": findings}, {"latency_ms": 5, "input_tokens": 0, "output_tokens": 0}

class BedrockProvider:
    name = "bedrock"
    def __init__(self):
        if not settings.BEDROCK_MODEL_ID:
            raise ProviderError("BEDROCK_MODEL_ID is not configured. Set AI_PROVIDER=mock for local/demo, or configure a Bedrock model ID you have been granted access to.")
        self.model_id = settings.BEDROCK_MODEL_ID
    def review(self, document_id, title, chunks, policy_rules, policy_id="", policy_version=""):
        import boto3
        from botocore.exceptions import ClientError
        client = boto3.client("bedrock-runtime", region_name=settings.BEDROCK_REGION)
        prompt = build_user_prompt(title, chunks, policy_rules)
        start = time.time()
        try:
            resp = client.converse(modelId=self.model_id, system=[{"text": SYSTEM_PROMPT}],
                messages=[{"role": "user", "content": [{"text": prompt}]}],
                inferenceConfig={"maxTokens": 2048, "temperature": 0.1})
        except ClientError as e:
            raise ProviderError(f"Bedrock error: {e.response.get('Error',{}).get('Code','unknown')} - check model access, region and IAM permissions.") from e
        latency = int((time.time()-start)*1000)
        text = resp["output"]["message"]["content"][0]["text"]
        usage = resp.get("usage", {})
        try:
            data = json.loads(text[text.index("{"):text.rindex("}")+1])
        except Exception as e:
            raise ProviderError("Bedrock returned non-JSON output; failing safely for human review.") from e
        return data, {"latency_ms": latency, "input_tokens": usage.get("inputTokens",0), "output_tokens": usage.get("outputTokens",0)}

def get_provider():
    if settings.AI_PROVIDER == "bedrock": return BedrockProvider()
    return MockProvider()

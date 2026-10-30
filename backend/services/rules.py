"""Deterministic rule engine + explicit priority scoring (documented in docs/evaluation.md & README).
Priority score: severity weight (low=10, medium=30, high=60, critical=90) + 10 if no evidence + 10 if confidence<0.5.
requires_human_review forced True when severity in (high, critical) OR evidence empty OR confidence < 0.6."""
SEV_W = {"low": 10, "medium": 30, "high": 60, "critical": 90}
def priority_score(finding):
    s = SEV_W.get(finding.get("severity","low"), 10)
    if not finding.get("evidence"): s += 10
    if float(finding.get("confidence", 0)) < 0.5: s += 10
    return min(s, 100)
def needs_human_review(finding):
    if finding.get("severity") in ("high","critical"): return True
    if not finding.get("evidence"): return True
    if float(finding.get("confidence", 0)) < 0.6: return True
    return bool(finding.get("requires_human_review", False))
def deterministic_findings(chunks, rules):
    """Rules format: {'requires_phrases': [...]} or list containing 'REQUIRES: x' strings."""
    phrases = []
    if isinstance(rules, dict): phrases = rules.get("requires_phrases", [])
    elif isinstance(rules, list):
        phrases = [r.split(":",1)[1].strip() for r in rules if isinstance(r, str) and r.startswith("REQUIRES:")]
    joined = " ".join(c["text"].lower() for c in chunks)
    out = []
    for i, phrase in enumerate(phrases):
        if phrase.lower() not in joined:
            out.append({"source": "rule_engine", "phrase": phrase, "index": i})
    return out

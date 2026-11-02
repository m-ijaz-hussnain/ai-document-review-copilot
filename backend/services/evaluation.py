"""Evaluation metrics computed from labelled cases — never hardcoded.
Unit: one labelled case = one document with expected finding categories."""
def compute_metrics(cases):
    """cases: list of dicts with expected (set), predicted (set), citation_ok (bool), escalated (bool)"""
    tp=fp=fn=0; cit_ok=0; cit_total=0; esc=0; valid=0
    for c in cases:
        e=set(c.get("expected",[])); p=set(c.get("predicted",[]))
        tp += len(e&p); fp += len(p-e); fn += len(e-p)
        if c.get("citation_total",0): cit_total += c["citation_total"]; cit_ok += c.get("citation_ok",0)
        if c.get("escalated"): esc += 1
        if c.get("output_valid", True): valid += 1
    n = len(cases) or 1
    precision = tp/(tp+fp) if (tp+fp) else 1.0
    recall = tp/(tp+fn) if (tp+fn) else 1.0
    return {"cases": len(cases), "tp": tp, "fp": fp, "fn": fn,
        "precision": round(precision,4), "recall": round(recall,4),
        "f1": round(2*precision*recall/(precision+recall),4) if (precision+recall) else 0.0,
        "false_positive_rate": round(fp/(fp+tp),4) if (fp+tp) else 0.0,
        "false_negative_rate": round(fn/(fn+tp),4) if (fn+tp) else 0.0,
        "citation_correctness": round(cit_ok/cit_total,4) if cit_total else 1.0,
        "structured_output_validity": round(valid/n,4),
        "escalation_rate": round(esc/n,4)}
def recall_at_k(relevant_ids, retrieved_ids, k=5):
    if not relevant_ids: return 1.0
    top = set(retrieved_ids[:k]); return round(len(set(relevant_ids)&top)/len(set(relevant_ids)),4)

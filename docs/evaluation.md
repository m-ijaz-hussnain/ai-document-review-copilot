# Evaluation

## What is measured, and the unit
Unit of evaluation = **one labelled case** (one synthetic document + expected finding categories). Metrics are computed by `backend/services/evaluation.py` from predictions — never hardcoded:

- Precision, recall, F1, false-positive rate, false-negative rate (category-level, TP/FP/FN counted per category per case)
- Citation correctness = verified evidence references ÷ total evidence references
- Retrieval recall@k (`recall_at_k` helper, unit-tested)
- Structured-output validity = outputs passing the Pydantic schema ÷ total outputs
- Escalation rate = cases with ≥1 finding requiring human review ÷ cases
- Latency (wall-clock for the run) and estimated cost (token count × operator-configured `COST_PER_1K_TOKENS_USD`; default 0 = unknown)

## Dataset
`backend/evaluation_data/dataset_v1.json` — **36 labelled synthetic cases** (dataset version 1.0), mixing compliant documents (expected: no findings) and documents missing a required element (expected: `missing_clause`). The build prompt suggested 100–200 cases; 36 real labelled cases ship now rather than a padded, low-quality 200. To extend: add cases in the same JSON shape (`case_id`, `text`, `requires_phrases`, `expected_categories`) and bump `dataset_version`.

## How to run
```bash
cd backend
python manage.py migrate
python manage.py run_evaluation
# writes evaluation_results/latest.json and latest.csv, and stores an EvaluationRun row
```

## Reading the shipped baseline honestly
With the **mock provider** the pipeline is deterministic keyword/rule matching on synthetic text written to exercise exactly those rules, so the baseline scores at/near 1.0. That validates the *plumbing* (schema, citations, metrics math, persistence) — it says **nothing** about a real LLM's quality on real documents. Set a quality target only after running the same dataset through Bedrock on realistic documents. Regression checks live in `backend/tests/` (metrics math, citation rejection, schema rejection).

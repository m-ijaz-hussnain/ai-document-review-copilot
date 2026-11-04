# Runbook

| Symptom | Check | Action |
|---|---|---|
| Document stuck in `queued` | Celery worker running? Broker reachable? | Start worker; check `CELERY_TASK_ALWAYS_EAGER` (true only for local/tests); reprocess via `POST /documents/{id}/reprocess/` |
| Document `failed` | `error_message` on the document + worker logs (request/job IDs) | Corrupt/empty file → tell the uploader; provider error → check `AI_PROVIDER`, Bedrock model access/region/IAM |
| Review `failed` with schema/citation error | Stored error message | Model output was rejected by design. Do not loosen validation silently; inspect the raw failure, adjust prompt version, re-run |
| Bedrock throttling/timeouts | Provider error code in logs, usage records | Reduce concurrency, request quota increase, back off — retries are bounded; failed reviews stay failed, never auto-passed |
| Sudden cost growth | `ModelUsageRecord` rows per org/user | Lower per-tenant quotas (throttles + `MAX_*` limits), check for upload abuse |
| Cross-tenant report | Audit events + the endpoint's queryset | Treat as a security incident: the org filter is the control; add a regression test before fixing forward |
| DB unavailable | `/health/ready/` returns 503 | Restore RDS/DB; the API fails closed (503), it does not serve stale/fabricated data |

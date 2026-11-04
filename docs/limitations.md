# Known Limitations — read before trusting this system

1. **Not legally compliant, not a legal product.** It assists human reviewers. It must not make or automate consequential legal, financial, employment or regulatory decisions, and its findings are leads for a human, not verdicts.
2. **Mock provider is deterministic keyword/rule matching**, not an LLM. Demo findings prove the pipeline, not AI quality. Real quality is only measurable via the evaluation framework against Bedrock on realistic documents.
3. **Evaluation dataset is small and synthetic (36 cases).** Scores on it — including a perfect mock baseline — do not generalise. Expand toward 100–200 realistic, reviewed cases before setting quality targets.
4. **Model confidence is uncalibrated.** It is a model-supplied score, displayed as such. It is not a probability that a finding is correct.
5. **Prompt injection cannot be fully prevented by prompting.** Defence is layered (data/instruction separation, output + citation validation, no tool access, human review) — residual risk remains; see `security.md`.
6. **Retrieval is hybrid but simple** (keyword + cosine in Python). It is correct and tenant-safe at demo scale; large corpora need the pgvector path and proper ranking evaluation.
7. **DOCX page numbers are approximate** (extracted as a single page unit — DOCX has no fixed pagination). PDF/TXT preserve real page/section positions.
8. **Auth is token-based for local/demo.** Production should use OIDC with short-lived tokens.
9. **Malware scanning is an integration point, not built in.** Do not accept real user files in production without scanning.
10. **Cost figures are estimates** from operator-configured pricing (default 0 = unknown). Token prices change; verify current Bedrock pricing yourself.
11. **Docker Compose stack was not executed in the build sandbox** (no Docker daemon available there). Dockerfiles/compose are provided and consistent with the verified local (SQLite) run; verify on your machine.
12. **No real Bedrock call was made during the build** (no AWS credentials in the sandbox). The Bedrock provider is implemented against the boto3 Converse API and fails with a clear, tested error when unconfigured; a live call still needs verification in your own AWS account.

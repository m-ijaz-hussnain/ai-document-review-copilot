# Security

## Threat model (summary)
| Threat | Mitigation in code | Residual risk |
|---|---|---|
| Cross-tenant data leak / IDOR | Every queryset is filtered by `request.user.organization`; cross-tenant object IDs return 404; automated tests cover this | A future endpoint that forgets the filter — mitigated by review + tests, not eliminated |
| Prompt injection in documents | System prompt declares documents are DATA, never instructions; retrieval content is delimited and labelled; output must pass Pydantic + citation validation; the model cannot call tools, change permissions or approve findings (no such capability exists in the provider interface) | **Prompt wording alone does NOT prevent prompt injection.** A determined injection can still influence wording of a finding — which is why every finding needs human review and citations are verified server-side |
| Malicious uploads | Extension allow-list (PDF/DOCX/TXT) + magic-byte check + size limit; files stored under generated UUID names outside any web root; content is never executed; DOCX/PDF parsed with data-only libraries | Parser vulnerabilities in pypdf/python-docx remain possible — keep dependencies updated; **run malware scanning (e.g. ClamAV or a managed scanner) before production use — scanning is an integration point, not built in** |
| Invented citations / hallucinated policy | Chunk IDs, page numbers and quotes are verified against stored chunks server-side; unknown IDs fail the review safely; policy claims must reference a stored policy version | A quote can be real while the *interpretation* is wrong — human review exists for this |
| Credential leakage | No secrets in code; env/Secrets Manager only; logs are structured JSON with messages only — document text and tokens are not logged | Operator misconfiguration (e.g. committing `.env`) — CI includes a basic secret-pattern scan |
| Auth | Django password hashing + DRF token auth for the demo/local path | For real deployment use OIDC/OAuth2 via a maintained provider and short-lived tokens; token auth here is a pragmatic local choice, documented as such |

## Controls implemented
Server-side RBAC (admin/reviewer/uploader), tenant isolation, rate throttling (DRF scoped throttles), upload/page limits, audit events for uploads, review creation, finding decisions, policy changes and deletions, least-privilege IAM guidance in `deployment.md`, private storage with no public file URLs, retention = delete removes the stored file and cascades chunks/findings (audit event for the deletion itself is written before delete). Per-action boundaries: starting a review and recording finding decisions require admin/reviewer (uploader receives 403); policy create/update/delete and add-version require admin (list/retrieve stay readable by any authenticated org user so reviewers can pick a policy version when starting a review); evaluation runs are admin-only. The frontend mirrors the same role model by showing each role only its pages, but no control relies on that hiding — every boundary above is enforced by the API.

## Honest limits
This project is **not** certified compliant with any regulation, and no control here should be read as a guarantee. See `limitations.md`.

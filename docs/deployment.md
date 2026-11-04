# Deployment (AWS)

> Nothing in this repository deploys anything automatically. There are no AWS credentials in the repo and no CI deploy step. Follow these steps manually when *you* decide to deploy.

## Target architecture (ECS Fargate)
- **Compute**: ECS Fargate service (API, gunicorn) + Fargate task (Celery worker, same image) behind an ALB with HTTPS (ACM certificate). Frontend: the built SPA served by nginx in a Fargate service, or S3 + CloudFront.
- **Data**: RDS PostgreSQL (private subnets only, `CREATE EXTENSION vector;` for pgvector), ElastiCache Redis (private), uploaded files in S3 with a private bucket + presigned access only through the API (the local `private_media` path is the dev stand-in).
- **Secrets**: AWS Secrets Manager → ECS task environment. Never put secrets in task definitions in plain text or in the repo.
- **IAM (least privilege)**: the task role gets only `bedrock:InvokeModel` / `bedrock:Converse` on the specific model ARN you enable, S3 access to the one bucket/prefix, and nothing else. No `*` actions. The CI role (if any) gets ECR push only.
- **Bedrock prerequisites**: request model access in the Bedrock console for your region, set `BEDROCK_MODEL_ID` + `AWS_REGION`, set `AI_PROVIDER=bedrock`. If the model/region is unavailable the API fails with an explicit provider error — it never silently falls back or fabricates output.
- **Networking**: DB/Redis security groups accept traffic only from the ECS tasks' security group. ALB is the only public ingress.
- **Observability**: structured JSON logs → CloudWatch Logs; alarms on failed Celery tasks, 5xx rate and queue depth; health checks on `/health/live/` and `/health/ready/`.
- **Migrations**: run `python manage.py migrate` as a one-off ECS task before shifting traffic.

## Local production-like check
`docker compose up --build` runs the same images with Postgres + Redis. (The build sandbox for this project had no Docker daemon, so the Compose stack is provided and reviewed but was **not** executed there — verify it on your machine; see README verification table.)

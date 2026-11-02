from celery import shared_task


@shared_task(bind=True, max_retries=1, default_retry_delay=5)
def run_review_task(self, job_id):
    from apps.reviews.models import ReviewJob
    from services.review_engine import run_review
    try: job = ReviewJob.objects.get(id=job_id)
    except ReviewJob.DoesNotExist: return {"status":"missing"}
    if job.status == ReviewJob.Status.COMPLETED and hasattr(job, "result"):
        return {"status":"already_completed"}
    job.status = ReviewJob.Status.RUNNING; job.document.status = "reviewing"; job.document.save(update_fields=["status"])
    job.save(update_fields=["status"])
    try:
        run_review(job)
        job.status = ReviewJob.Status.COMPLETED; job.error_message=""; job.save(update_fields=["status","error_message"])
        job.document.status = "completed"; job.document.save(update_fields=["status"])
        return {"status":"completed"}
    except Exception as exc:
        job.status = ReviewJob.Status.FAILED; job.error_message = str(exc)[:1000]; job.save(update_fields=["status","error_message"])
        job.document.status = "failed"; job.document.error_message = str(exc)[:1000]; job.document.save(update_fields=["status","error_message"])
        return {"status":"failed","error":str(exc)}

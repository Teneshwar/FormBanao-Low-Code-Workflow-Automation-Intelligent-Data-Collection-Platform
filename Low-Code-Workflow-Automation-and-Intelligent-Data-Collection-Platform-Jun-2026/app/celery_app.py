from celery import Celery
import os

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL") or "redis://localhost:6379/0"
celery_app = Celery("app", broker=CELERY_BROKER_URL)
celery_app.conf.update(result_backend=CELERY_BROKER_URL)

# Optional: load task modules automatically
celery_app.autodiscover_tasks(['app.tasks'])

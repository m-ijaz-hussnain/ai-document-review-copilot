import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-in-prod")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")
INSTALLED_APPS = [
    "django.contrib.admin","django.contrib.auth","django.contrib.contenttypes",
    "django.contrib.sessions","django.contrib.messages","django.contrib.staticfiles",
    "rest_framework","rest_framework.authtoken","drf_spectacular","corsheaders",
    "apps.accounts","apps.documents","apps.policies","apps.reviews","apps.audit","apps.evaluation","apps.usage",
]
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "services.middleware.RequestIDMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True, "OPTIONS": {"context_processors": ["django.template.context_processors.request", "django.contrib.auth.context_processors.auth", "django.contrib.messages.context_processors.messages"]}}]
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
_db_url = os.environ.get("DATABASE_URL", "")
if _db_url.startswith("postgres"):
    # postgres://user:pass@host:5432/dbname
    from urllib.parse import urlparse
    u = urlparse(_db_url)
    DATABASES = {"default": {"ENGINE": "django.db.backends.postgresql", "NAME": u.path.lstrip("/"), "USER": u.username or "", "PASSWORD": u.password or "", "HOST": u.hostname or "db", "PORT": str(u.port or 5432)}}
AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = []
LANGUAGE_CODE = "en-us"; TIME_ZONE = "UTC"; USE_I18N = True; USE_TZ = True
STATIC_URL = "static/"; DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
MEDIA_ROOT = BASE_DIR / "private_media"
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.TokenAuthentication","rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": "100/hour", "user": "2000/hour", "upload": "30/hour", "review": "60/hour"},
    "EXCEPTION_HANDLER": "services.errors.api_exception_handler",
}
SPECTACULAR_SETTINGS = {"TITLE": "AI Document Review & Compliance Copilot API", "DESCRIPTION": "Document review with RAG, Bedrock and human oversight. AI assists reviewers; it does not make consequential decisions autonomously.", "VERSION": "1.0.0"}
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = [x for x in os.environ.get("CORS_ALLOWED_ORIGINS","http://localhost:5173").split(",") if x]
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
CELERY_TASK_ALWAYS_EAGER = os.environ.get("CELERY_TASK_ALWAYS_EAGER", "true").lower() == "true"
CELERY_TASK_EAGER_PROPAGATES = True
# AI config — never hardcode a guaranteed model; operator must configure + request Bedrock access
AI_PROVIDER = os.environ.get("AI_PROVIDER", "mock")  # mock | bedrock
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "")
BEDROCK_REGION = os.environ.get("AWS_REGION", "us-east-1")
EMBEDDING_PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "local")  # local | bedrock
EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "64"))
EMBEDDING_MODEL_ID = os.environ.get("EMBEDDING_MODEL_ID", "")
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "10"))
MAX_PAGES = int(os.environ.get("MAX_PAGES", "200"))
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", "100"))
RETRIEVAL_TOP_K = int(os.environ.get("RETRIEVAL_TOP_K", "5"))
# Pricing is operator-configured estimate only; defaults are 0 = unknown, never presented as current prices
COST_PER_1K_TOKENS_USD = float(os.environ.get("COST_PER_1K_TOKENS_USD", "0"))
LOGGING = {"version":1,"disable_existing_loggers":False,"formatters":{"json":{"()":"services.logging.JsonFormatter"}},"handlers":{"console":{"class":"logging.StreamHandler","formatter":"json"}},"root":{"handlers":["console"],"level":"INFO"}}

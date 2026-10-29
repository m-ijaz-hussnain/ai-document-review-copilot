from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def live(request):
    return JsonResponse({"status": "ok"})

def ready(request):
    from django.db import connection
    try:
        connection.ensure_connection()
        return JsonResponse({"status": "ready", "database": "ok"})
    except Exception:
        return JsonResponse({"status": "not_ready"}, status=503)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/live/", live),
    path("health/ready/", ready),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger"),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.documents.urls")),
    path("api/v1/", include("apps.policies.urls")),
    path("api/v1/", include("apps.reviews.urls")),
    path("api/v1/", include("apps.audit.urls")),
    path("api/v1/", include("apps.evaluation.urls")),
]

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FindingViewSet, ReviewViewSet, create_review, dashboard_stats

router = DefaultRouter(); router.register("reviews", ReviewViewSet, basename="reviews"); router.register("findings", FindingViewSet, basename="findings")
urlpatterns = [path("documents/<uuid:document_id>/reviews/", create_review), path("dashboard/stats/", dashboard_stats), path("", include(router.urls))]

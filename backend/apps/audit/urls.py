from rest_framework.routers import DefaultRouter

from .views import AuditViewSet

router = DefaultRouter(); router.register("audit-events", AuditViewSet, basename="audit")
urlpatterns = router.urls

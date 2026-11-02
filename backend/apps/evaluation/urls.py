from rest_framework.routers import DefaultRouter

from .views import EvalViewSet

router = DefaultRouter(); router.register("evaluation-runs", EvalViewSet, basename="evaluation")
urlpatterns = router.urls

from rest_framework.routers import DefaultRouter

from .views import PolicyViewSet

router = DefaultRouter(); router.register("policies", PolicyViewSet, basename="policies")
urlpatterns = router.urls

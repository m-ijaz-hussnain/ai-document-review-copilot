from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import UserViewSet, login_view, me_view

router = DefaultRouter(); router.register("users", UserViewSet, basename="users")
urlpatterns = [path("auth/login/", login_view), path("auth/me/", me_view), path("", include(router.urls))]

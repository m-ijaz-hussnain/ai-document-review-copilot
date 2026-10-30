from django.contrib.auth import authenticate
from rest_framework import viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import User
from .permissions import IsAdmin
from .serializers import ProfileUpdateSerializer, UserSerializer


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    user = authenticate(username=request.data.get("username",""), password=request.data.get("password",""))
    if not user: return Response({"error":{"code":401,"message":"Invalid credentials","details":None}}, status=401)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": UserSerializer(user).data})

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me_view(request):
    if request.method == "PATCH":
        # Only ever updates request.user — there is no way to address
        # another user through this endpoint.
        s = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        s.is_valid(raise_exception=True); s.save()
    return Response(UserSerializer(request.user).data)

class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    def get_queryset(self):
        return User.objects.filter(organization=self.request.user.organization).order_by("-date_joined")
    def perform_create(self, serializer):
        pw = self.request.data.get("password","ChangeMe123!")
        user = serializer.save(organization=self.request.user.organization)
        user.set_password(pw); user.save()

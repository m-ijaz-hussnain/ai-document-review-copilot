from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated and request.user.role == "admin")
class IsReviewerOrAdmin(BasePermission):
    def has_permission(self, request, view): return bool(request.user and request.user.is_authenticated and request.user.role in ("admin","reviewer"))
def same_org_or_none(user, org_id):
    return user.organization_id is not None and str(user.organization_id) == str(org_id)

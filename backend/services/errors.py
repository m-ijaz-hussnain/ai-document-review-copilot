from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    resp = exception_handler(exc, context)
    if resp is not None:
        detail = resp.data
        msg = detail.get("detail") if isinstance(detail, dict) else None
        return Response({"error": {"code": resp.status_code, "message": str(msg) if msg else "Request failed", "details": detail}}, status=resp.status_code)
    return Response({"error": {"code": 500, "message": "Internal server error", "details": None}}, status=500)

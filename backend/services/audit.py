def record(org, actor, action, object_type, object_id, metadata=None):
    from apps.audit.models import AuditEvent
    return AuditEvent.objects.create(organization=org, actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action, object_type=object_type, object_id=str(object_id), metadata=metadata or {})

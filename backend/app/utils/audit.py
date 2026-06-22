from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import ActivityLog, LoginHistory


def _truncate(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    return value if len(value) <= limit else value[:limit]


def log_audit_event(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    status: str = "SUCCESS",
    reason: str | None = None,
    token: str | None = None,
    session_id: str | None = None,
    ip_address: str | None = None,
    device_info: str | None = None,
    user_agent: str | None = None,
):
    now = datetime.now(timezone.utc)
    db.add(
        LoginHistory(
            user_id=user_id,
            login_identifier=_truncate(action, 150) or "UNKNOWN",
            login_status=_truncate(status, 20) or "UNKNOWN",
            failure_reason=_truncate(reason, 255),
            ip_address=_truncate(ip_address, 45),
            device_info=_truncate(device_info, 255),
            user_agent=user_agent,
            session_token=token,
            session_id=_truncate(session_id, 64),
            logged_in_at=now,
            created_at=now,
        )
    )


def log_activity_event(
    db: Session,
    *,
    user_id: int | None,
    session_id: str | None = None,
    method: str,
    endpoint: str,
    action: str,
    activity_status: str = "SUCCESS",
    reason: str | None = None,
    http_status_code: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    request_id: str | None = None,
    route_template: str | None = None,
    duration_ms: int | None = None,
    error_code: str | None = None,
    client_type: str | None = None,
    meta: dict[str, Any] | None = None,
    created_by: int | None = None,
    updated_by: int | None = None,
):
    now = datetime.now(timezone.utc)
    db.add(
        ActivityLog(
            user_id=user_id,
            activity_at=now,
            method=_truncate(method, 10) or "GET",
            endpoint=_truncate(endpoint, 255) or "/",
            action=_truncate(action, 150) or "UNKNOWN",
            activity_status=_truncate(activity_status, 20) or "UNKNOWN",
            reason=_truncate(reason, 255),
            http_status_code=http_status_code,
            ip_address=_truncate(ip_address, 45),
            user_agent=user_agent,
            request_id=_truncate(request_id, 64),
            session_id=_truncate(session_id, 64),
            route_template=_truncate(route_template, 255),
            duration_ms=duration_ms,
            error_code=_truncate(error_code, 64),
            client_type=_truncate(client_type, 20),
            meta=meta or {},
            created_at=now,
            updated_at=now,
            created_by=created_by,
            updated_by=updated_by,
        )
    )

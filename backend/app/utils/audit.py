from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import LoginHistory


def log_audit_event(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    status: str = "SUCCESS",
    reason: str | None = None,
    token: str | None = None,
):
    now = datetime.now(timezone.utc)
    db.add(
        LoginHistory(
            user_id=user_id,
            login_identifier=action,
            login_status=status,
            failure_reason=reason,
            session_token=token,
            logged_in_at=now,
            created_at=now,
        )
    )

import os

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.db.models import User
from app.db.session import SessionLocal
from app.utils.audit import log_activity_event


class ActivityAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if request.url.path.startswith(("/docs", "/openapi.json", "/redoc")):
            return response

        token = self._extract_bearer_token(request)
        user_id = self._get_user_id_from_token(token)
        if user_id is None:
            return response

        action = f"{request.method} {request.url.path}"
        activity_status = "SUCCESS" if response.status_code < 400 else "FAILED"
        reason = None if activity_status == "SUCCESS" else f"HTTP {response.status_code}"

        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        request_id = response.headers.get("X-Request-ID")

        db = SessionLocal()
        try:
            log_activity_event(
                db,
                user_id=user_id,
                method=request.method,
                endpoint=request.url.path,
                action=action,
                activity_status=activity_status,
                reason=reason,
                http_status_code=response.status_code,
                ip_address=client_ip,
                user_agent=user_agent,
                request_id=request_id,
                created_by=user_id,
                updated_by=user_id,
            )
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

        return response

    @staticmethod
    def _extract_bearer_token(request: Request) -> str | None:
        auth_header = request.headers.get("authorization")
        if not auth_header:
            return None
        parts = auth_header.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None
        return parts[1].strip()

    @staticmethod
    def _get_user_id_from_token(token: str | None) -> int | None:
        if not token:
            return None

        secret_key = os.getenv("SECRET_KEY", "change_me")
        algorithm = os.getenv("ALGORITHM", "HS256")

        try:
            payload = jwt.decode(token, secret_key, algorithms=[algorithm])
            username = payload.get("sub")
            if not username:
                return None
        except JWTError:
            return None

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.username == username, User.status == 1).first()
            return user.id if user else None
        finally:
            db.close()

import os
import time

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.db.models import User
from app.db.session import SessionLocal
from app.utils.audit import log_activity_event


class ActivityAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - start_time) * 1000)

        if request.url.path.startswith(("/docs", "/openapi.json", "/redoc")):
            return response

        try:
            token = self._extract_bearer_token(request)
            user_info = self._get_user_info_from_token(token)
            if user_info is None:
                return response

            user_id, session_id, client_type = user_info

            action = f"{request.method} {request.url.path}"
            
            # Refined activity status logic: 
            # - SUCCESS for 2xx/3xx
            # - SUCCESS/NOT_FOUND for 404 GET (usually search/lookup)
            # - FAILED for others (401, 403, 500, etc.)
            if response.status_code < 400:
                activity_status = "SUCCESS"
                reason = None
            elif response.status_code == 404 and request.method == "GET":
                activity_status = "SUCCESS"
                reason = "Not Found (404)"
            else:
                activity_status = "FAILED"
                reason = f"HTTP {response.status_code}"

            client_ip = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
            request_id = response.headers.get("X-Request-ID")
            route_template = self._get_route_template(request)
            error_code = None if response.status_code < 400 else f"HTTP_{response.status_code}"
            
            # Extract metadata from request state if attached by the endpoint
            audit_meta = getattr(request.state, "audit_meta", {})
            
            meta = {
                "query_params": dict(request.query_params),
                "path_params": request.path_params,
                "status_family": f"{response.status_code // 100}xx",
                **audit_meta
            }

            db = SessionLocal()
            try:
                log_activity_event(
                    db,
                    user_id=user_id,
                    session_id=session_id,
                    client_type=client_type,
                    method=request.method,
                    endpoint=request.url.path,
                    action=action,
                    activity_status=activity_status,
                    reason=reason,
                    http_status_code=response.status_code,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    request_id=request_id,
                    route_template=route_template,
                    duration_ms=duration_ms,
                    error_code=error_code,
                    meta=meta,
                    created_by=user_id,
                    updated_by=user_id,
                )
                db.commit()

            except Exception:
                db.rollback()
            finally:
                db.close()
        except Exception:
            # Audit failure should not break the main request
            pass

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
    def _get_route_template(request: Request) -> str:
        route = request.scope.get("route")
        template = getattr(route, "path", None)
        return template or request.url.path

    @staticmethod
    def _get_user_info_from_token(token: str | None) -> tuple[int, str | None, str | None] | None:
        if not token:
            return None

        secret_key = os.getenv("SECRET_KEY", "change_me")
        algorithm = os.getenv("ALGORITHM", "HS256")

        try:
            payload = jwt.decode(token, secret_key, algorithms=[algorithm], options={"verify_exp": False})
            username = payload.get("sub")
            session_id = payload.get("sid")
            client_type = payload.get("ct")
            if not username:
                return None
        except JWTError:
            return None

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.username == username, User.status == 1, User.is_deleted == False).first()
            if not user:
                return None
            return user.id, session_id, client_type
        finally:
            db.close()

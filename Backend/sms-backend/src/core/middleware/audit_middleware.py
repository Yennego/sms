import json
from typing import Optional
from uuid import UUID
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from src.core.security.jwt import verify_token
from src.db.session import get_db, get_super_admin_db
from src.services.logging import AuditLoggingService
from src.services.logging.super_admin_activity_log_service import SuperAdminActivityLogService


SENSITIVE_KEY_PARTS = ("password", "token", "secret")


def redact(value):
    """Replace password/token/secret fields (at any depth) so they never reach the audit log."""
    if isinstance(value, dict):
        return {
            k: "[REDACTED]" if any(p in str(k).lower() for p in SENSITIVE_KEY_PARTS) else redact(v)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all API requests and responses for audit purposes."""
    
    def __init__(self, app):
        super().__init__(app)
        self.excluded_paths = {
            "/docs", "/redoc", "/openapi.json", "/favicon.ico",
            "/health", "/metrics"
        }
    
    def is_super_admin_operation(self, request: Request) -> bool:
        """Check if this is a super-admin operation based on the URL path."""
        return "/super-admin/" in str(request.url.path)
    
    async def extract_user_info(self, request: Request) -> tuple[Optional[UUID], Optional[UUID], bool]:
        """Extract user_id, tenant_id, and super_admin status from JWT token."""
        try:
            # Get token from Authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return None, None, False
            
            token = auth_header.split(" ")[1]
            payload = await verify_token(token)
            
            if not payload:
                return None, None, False
            
            # Access TokenPayload attributes directly, not as dictionary
            user_id = UUID(payload.sub) if payload.sub else None
            tenant_id = UUID(payload.tenant_id) if payload.tenant_id else None
            is_super_admin = payload.is_super_admin  # Access as attribute, not dictionary key
            
            return user_id, tenant_id, is_super_admin
        except Exception:
            return None, None, False
    
    def determine_action_and_entity(self, request: Request) -> tuple[str, str]:
        """Determine the action and entity type based on the request."""
        method = request.method.lower()
        path = str(request.url.path)
        
        # Map HTTP methods to actions
        action_map = {
            "get": "view",
            "post": "create",
            "put": "update",
            "patch": "update",
            "delete": "delete"
        }
        
        action = action_map.get(method, "unknown")
        if "/change-password" in path or "/reset-password" in path:
            return "update", "user"

        # Determine entity type from path
        if "/auth/me/signature" in path:
            entity_type = "signature"
        elif "/tenants/self/profile" in path:
            entity_type = "school_profile"
        elif "/users" in path:
            entity_type = "user"
        elif "/tenants" in path:
            entity_type = "tenant"
        elif "/audit-logs" in path:
            entity_type = "audit_log"
        elif "/roles" in path:
            entity_type = "role"
        elif "/permissions" in path:
            entity_type = "permission"
        elif "/students" in path:
            entity_type = "student"
        elif "/teachers" in path:
            entity_type = "teacher"
        elif "/staff" in path:
            entity_type = "staff"
        elif "/parents" in path:
            entity_type = "parent"
        elif "/academic-grades" in path:
            entity_type = "academic_grade"
        elif "/academic-years" in path:
            entity_type = "academic_year"
        elif "/sections" in path:
            entity_type = "section"
        elif "/subjects" in path:
            entity_type = "subject"
        elif "/grading-schemas" in path:
            entity_type = "grading_schema"
        elif "/exams" in path:
            entity_type = "exam"
        elif "/enrollments" in path:
            entity_type = "enrollment"
        elif "/timetables" in path:
            entity_type = "timetable"
        elif "/attendance" in path:
            entity_type = "attendance"
        elif "/assignments" in path:
            entity_type = "assignment"
        elif "/grades" in path:
            entity_type = "grade"
        elif "/announcements" in path:
            entity_type = "announcement"
        elif "/dashboard" in path:
            entity_type = "dashboard"
        elif "/auth" in path:
            entity_type = "auth"
        else:
            entity_type = "system"
        
        return action, entity_type
    
    # Session endpoints change no school data, so they aren't audit events
    SESSION_PATHS = ("/auth/login", "/auth/token", "/auth/refresh", "/auth/logout", "/auth/me")
    # Image uploads (signatures, school seal): the change is audited, the file never is
    NO_BODY_PATHS = ("/auth/me/signature", "/tenants/self/profile/seal")

    def is_no_body_path(self, request: Request) -> bool:
        path = str(request.url.path).rstrip("/")
        return any(path.endswith(p) for p in self.NO_BODY_PATHS)

    def should_log_request(self, request: Request) -> bool:
        """Only data changes (create/update/delete) are audited; reads are not."""
        if request.method.lower() not in ["post", "put", "patch", "delete"]:
            return False
        if self.is_no_body_path(request):
            return True
        path = str(request.url.path)
        return not any(path.endswith(p) or f"{p}/" in path for p in self.SESSION_PATHS)

    def target_tenant_of(self, request: Request, token_tenant_id: Optional[UUID]) -> Optional[UUID]:
        """The school a super-admin request acted on: explicit query param, then X-Tenant-ID header."""
        for raw in (request.query_params.get("tenant_id"), request.headers.get("X-Tenant-ID")):
            if raw:
                try:
                    return UUID(raw)
                except ValueError:
                    pass
        # On /super-admin/ routes the token's own tenant is just the account's home school
        return None if self.is_super_admin_operation(request) else token_tenant_id

    def get_log_priority(self, request: Request) -> str:
        """Determine log priority for retention policies."""
        method = request.method.lower()
        path = str(request.url.path)
        
        # Critical operations - keep longer
        if method in ["delete"] or "/admin" in path:
            return "critical"  # Keep 2+ years
            
        # Important operations - medium retention
        if method in ["post", "put", "patch"]:
            return "important"  # Keep 1 year
            
        # Informational - short retention
        return "info"  # Keep 3-6 months

    async def dispatch(self, request: Request, call_next):
        # Skip logging for excluded paths
        if any(excluded in str(request.url.path) for excluded in self.excluded_paths):
            return await call_next(request)
        
        # Check if we should log this request
        if not self.should_log_request(request):
            return await call_next(request)
        
        # Extract user information
        user_id, tenant_id, is_super_admin = await self.extract_user_info(request)
        
        # Determine action and entity type
        action, entity_type = self.determine_action_and_entity(request)
        
        # Capture request body for state-changing operations
        request_body = None
        if request.method.lower() in ["post", "put", "patch", "delete"] and not self.is_no_body_path(request):
            try:
                # IMPORTANT: Consuming request.body() exhausts the stream.
                # We must replace it so downstream handlers (like FastAPI route handlers) can read it.
                body = await request.body()
                
                # Restore the request body stream immediately so downstream always gets it
                async def receive():
                    return {"type": "http.request", "body": body}
                request._receive = receive

                if body and body.strip():
                    content_type = request.headers.get("Content-Type", "")
                    if "application/json" in content_type:
                        try:
                            request_body = redact(json.loads(body.decode('utf-8')))
                        except json.JSONDecodeError:
                             print(f"[AuditMiddleware] Non-JSON or malformed body for {request.method} {request.url.path}")
                    else:
                        # For non-JSON (like multipart/form-data), we don't try to parse as JSON
                        # but we've already restored the stream above.
                        pass
            except Exception as e:
                import traceback
                print(f"[AuditMiddleware] ERROR capturing body for {request.method} {request.url.path}: {repr(e)}")
                # We still want to continue to call_next
        
        # Extract entity ID from URL path
        entity_id = self.extract_entity_id_from_path(request)
        
        # Process the request
        response = await call_next(request)
        
        # Only log successful requests (2xx status codes)
        if 200 <= response.status_code < 300:
            try:
                # Super-admin activity never goes into a school's log, whatever the route
                if is_super_admin:
                    db = next(get_super_admin_db())
                    try:
                        super_admin_service = SuperAdminActivityLogService(db=db)
                        target_tenant_id = self.target_tenant_of(request, tenant_id)

                        # Generate enhanced details
                        details = self.generate_enhanced_details(request, action, entity_type, entity_id, request_body, target_tenant_id)
                        
                        await super_admin_service.log_super_admin_activity(
                            user_id=user_id,
                            action=action,
                            entity_type=entity_type,
                            entity_id=entity_id,
                            target_tenant_id=target_tenant_id,
                            new_values=request_body,
                            details=details,
                            request=request
                        )
                        db.commit()  # outside the request's unit of work: commit the log row
                    finally:
                        db.close()
                
                elif tenant_id:  # Regular tenant-based logging
                    db = next(get_db())
                    try:
                        audit_service = AuditLoggingService(db=db, tenant_id=tenant_id)
                        await audit_service.log_activity(
                            user_id=user_id,
                            action=action,
                            entity_type=entity_type,
                            entity_id=entity_id,
                            new_values=request_body,
                            request=request
                        )
                        db.commit()  # outside the request's unit of work: commit the log row
                    finally:
                        db.close()
                        
            except Exception as e:
                # Log the error but don't fail the request
                print(f"Audit logging error: {e}")        
        return response

    def extract_entity_id_from_path(self, request: Request) -> Optional[UUID]:
        """Extract entity ID from URL path."""
        import re
        path = str(request.url.path)
        
        # 1. Check for UUID patterns in the path (standard IDs)
        uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        matches = re.findall(uuid_pattern, path, re.IGNORECASE)
        
        if matches:
            try:
                # Often the last UUID is the resource ID (the first might be tenant_id in some routers)
                # But if we have /entity/{id}/sub-entity/{sub_id}, we probably want sub_id
                return UUID(matches[-1])
            except ValueError:
                pass
        
        # 2. Check for numeric IDs (common in some legacy or specific endpoints)
        numeric_id_pattern = r'/(\d+)(/|$)'
        num_matches = re.search(numeric_id_pattern, path)
        if num_matches:
            # We don't log numeric IDs as UUIDs, so we return None or handled differently
            # For this system, we mainly use UUIDs
            pass
            
        return None
    
    def generate_enhanced_details(self, request: Request, action: str, entity_type: str, 
                            entity_id: Optional[UUID], request_body: Optional[dict], 
                            target_tenant_id: Optional[UUID]) -> str:
        """Generate enhanced details for audit logs."""
        path = str(request.url.path)
        details_parts = []
        
        # Base action description
        if action == "create":
            details_parts.append(f"Created new {entity_type}")
        elif action == "update":
            details_parts.append(f"Updated {entity_type}")
        elif action == "delete":
            details_parts.append(f"Deleted {entity_type}")
        else:
            details_parts.append(f"Super-admin {action} on {entity_type}")
        
        # Add entity ID if available
        if entity_id:
            details_parts.append(f"(ID: {str(entity_id)})")
        
        # Add specific field changes for updates
        if action == "update" and request_body:
            changed_fields = list(request_body.keys())
            if changed_fields:
                if len(changed_fields) <= 3:
                    details_parts.append(f"Fields: {', '.join(changed_fields)}")
                else:
                    details_parts.append(f"Fields: {', '.join(changed_fields[:3])} and {len(changed_fields)-3} more")
        
        # Add tenant context
        if target_tenant_id:
            details_parts.append(f"for tenant {str(target_tenant_id)[:8]}...")
        
        # Add endpoint context
        if "/activate" in path:
            details_parts.append("(Activation)")
        elif "/deactivate" in path:
            details_parts.append("(Deactivation)")
        elif "/reset-password" in path:
            details_parts.append("(Password Reset)")
        elif "/assign-role" in path:
            details_parts.append("(Role Assignment)")
        
        return " ".join(details_parts)

    def should_log_get_request(self, request: Request, response_time: float) -> bool:
        """Determine if GET request should be logged."""
        path = str(request.url.path)
        
        # Always log access to sensitive endpoints
        sensitive_endpoints = [
            "/users", "/audit-logs", "/admin", "/super-admin",
            "/financial", "/grades", "/reports"
        ]
        
        if any(endpoint in path for endpoint in sensitive_endpoints):
            return True
            
        # Log slow requests (potential data export/bulk operations)
        if response_time > 2.0:  # 2 seconds
            return True
            
        return False
from fastapi.openapi.utils import get_openapi
from app.main import app

try:
    schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )
    print("Schema generated successfully")
except Exception as e:
    import traceback
    traceback.print_exc()

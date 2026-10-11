from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, field: str | None = None,
                 retryable: bool = False, extra: dict | None = None):
        self.code, self.message, self.status = code, message, status
        self.field, self.retryable, self.extra = field, retryable, extra or {}


def body(code, message, field=None, retryable=False, **extra):
    return {"code": code, "message": message, "field": field, "retryable": retryable, **extra}


def install(app: FastAPI):
    @app.exception_handler(ApiError)
    async def _api(_: Request, e: ApiError):
        return JSONResponse(body(e.code, e.message, e.field, e.retryable, **e.extra), status_code=e.status)

    @app.exception_handler(RequestValidationError)
    async def _val(_: Request, e: RequestValidationError):
        errs = [{"field": ".".join(str(p) for p in x["loc"][1:]) or None, "message": x["msg"]} for x in e.errors()]
        first = errs[0] if errs else {"field": None, "message": "Invalid request"}
        return JSONResponse(body("validation_error", first["message"], first["field"], False, errors=errs), status_code=422)

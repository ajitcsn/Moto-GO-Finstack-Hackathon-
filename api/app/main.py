import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import errors, models  # noqa: F401  (models import registers tables)
from .config import settings
from .db import Base, SessionLocal, engine
from .routers import applications, auth, documents, explore, garage, misc, users
from .security import csrf_middleware
from .seed_catalogue import seed_catalogue
from .seed_demo import seed_demo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)  # dev convenience; use `alembic upgrade head` for real databases
    with SessionLocal() as db:
        seed_catalogue(db)
        seed_demo(db)
    yield


app = FastAPI(title="Moto Go API", version="0.1.0", lifespan=lifespan)
errors.install(app)
app.middleware("http")(csrf_middleware)
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

api = APIRouter(prefix="/api/v1")
for r in (auth.router, users.router, garage.router, explore.router, applications.router, documents.router, misc.router):
    api.include_router(r)
app.include_router(api)


@app.get("/healthz")
def healthz():
    return {"ok": True}

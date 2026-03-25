from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models import Base
from app.routers import assessment, auth, badges


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup (if not using init.sql), dispose engine on shutdown."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="PromptRanks API",
    description="AI Prompt Engineering Assessment Platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.effective_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assessment.router)
app.include_router(auth.router)
app.include_router(badges.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import async_session, engine
from app.models import Base
from app.routers import assessment, auth, badges, leaderboard
from app.services.leaderboard_service import rebuild_all
from app.services.redis_client import close_redis, get_redis

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup, restore leaderboard cache when empty, then clean up on shutdown."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    redis = await get_redis()
    if await redis.zcard("lb:alltime") == 0:
        async with async_session() as session:
            result = await rebuild_all(session, redis)
            logger.info("Leaderboard cache rebuilt on startup", extra=result)

    yield
    await close_redis()
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
app.include_router(leaderboard.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}

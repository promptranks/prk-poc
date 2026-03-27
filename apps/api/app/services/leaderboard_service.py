"""Leaderboard service: Redis sorted-set operations for the public leaderboard."""

import json
from datetime import datetime, timezone, date
from typing import Any

import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

LEVEL_NAMES: dict[int, str] = {
    1: "Novice",
    2: "Practitioner",
    3: "Proficient",
    4: "Expert",
    5: "Master",
}

VALID_PERIODS = ("alltime", "weekly", "monthly", "quarterly")


def get_period_key(period: str, ref_date: date | None = None) -> str:
    """Return the Redis sorted-set key for the given period."""
    if ref_date is None:
        ref_date = datetime.now(timezone.utc).date()

    if period == "alltime":
        return "lb:alltime"
    if period == "weekly":
        iso = ref_date.isocalendar()
        return f"lb:weekly:{iso.year}:{iso.week:02d}"
    if period == "monthly":
        return f"lb:monthly:{ref_date.year}:{ref_date.month:02d}"
    if period == "quarterly":
        q = (ref_date.month - 1) // 3 + 1
        return f"lb:quarterly:{ref_date.year}:{q}"
    return "lb:alltime"


def get_display_name(name: str) -> str:
    """Privacy-safe display name: 'John Doe' -> 'John D.', single name unchanged."""
    name = (name or "").strip()
    if not name:
        return "Anonymous"
    parts = name.split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[1][0]}."


async def update_score(
    redis: aioredis.Redis,
    user_id: str,
    score: float,
    user_name: str,
    level: int,
    level_name: str,
    pillar_scores: dict[str, Any] | None,
    badge_id: str | None,
    achieved_at: str,
    industry_id: str | None = None,
    role_id: str | None = None,
) -> None:
    """Update leaderboard sorted sets with GT semantics (only improve scores)."""
    now_date = datetime.now(timezone.utc).date()
    keys = [
        get_period_key("alltime"),
        get_period_key("weekly", now_date),
        get_period_key("monthly", now_date),
        get_period_key("quarterly", now_date),
    ]
    if industry_id:
        keys.append(f"lb:industry:{industry_id}:alltime")
    if role_id:
        keys.append(f"lb:role:{role_id}:alltime")

    pipe = redis.pipeline()
    for key in keys:
        pipe.zadd(key, {user_id: score}, gt=True)

    # Store user metadata hash (TTL 3600 is refreshed on each update)
    meta = {
        "user_id": user_id,
        "display_name": get_display_name(user_name),
        "level": level,
        "level_name": level_name,
        "pillar_scores": pillar_scores or {},
        "badge_id": badge_id or "",
        "achieved_at": achieved_at,
    }
    pipe.setex(f"lb:user:{user_id}", 3600, json.dumps(meta))
    await pipe.execute()


async def get_leaderboard(
    redis: aioredis.Redis,
    period: str = "alltime",
    industry_id: str = "",
    role_id: str = "",
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    """Fetch a page of leaderboard entries with metadata."""
    if industry_id:
        key = f"lb:industry:{industry_id}:alltime"
    elif role_id:
        key = f"lb:role:{role_id}:alltime"
    else:
        key = get_period_key(period)

    offset = (page - 1) * page_size
    pipe = redis.pipeline()
    pipe.zrevrange(key, offset, offset + page_size - 1, withscores=True)
    pipe.zcard(key)
    results = await pipe.execute()
    entries_raw: list[tuple[str, float]] = results[0]
    total: int = results[1]

    entries: list[dict[str, Any]] = []
    rank_start = offset + 1

    for idx, (user_id, score) in enumerate(entries_raw):
        meta_json = await redis.get(f"lb:user:{user_id}")
        if meta_json:
            meta: dict[str, Any] = json.loads(meta_json)
        else:
            meta = {
                "display_name": "Anonymous",
                "level": 1,
                "level_name": "Novice",
                "pillar_scores": {},
                "badge_id": "",
                "achieved_at": "",
            }

        entries.append({
            "rank": rank_start + idx,
            "user_id": user_id,
            "display_name": meta.get("display_name", "Anonymous"),
            "level": meta.get("level", 1),
            "level_name": meta.get("level_name", "Novice"),
            "score": score,
            "pillar_scores": meta.get("pillar_scores", {}),
            "badge_id": meta.get("badge_id", ""),
            "achieved_at": meta.get("achieved_at", ""),
        })

    return {
        "entries": entries,
        "total": total,
        "page": page,
        "page_size": page_size,
        "period": period,
    }


async def get_user_rank(
    redis: aioredis.Redis,
    user_id: str,
    period: str = "alltime",
) -> dict[str, Any] | None:
    """Return {rank (1-based), score, total} for a user in the given period, or None."""
    key = get_period_key(period)
    pipe = redis.pipeline()
    pipe.zrevrank(key, user_id)
    pipe.zscore(key, user_id)
    pipe.zcard(key)
    results = await pipe.execute()
    rev_rank, score, total = results

    if rev_rank is None or score is None:
        return None

    return {"rank": rev_rank + 1, "score": score, "total": total}


async def get_user_summary(
    redis: aioredis.Redis,
    user_id: str,
) -> dict[str, Any]:
    """Return rank across all periods plus ±5 nearby entries for alltime."""
    summary: dict[str, Any] = {}
    for period in VALID_PERIODS:
        summary[period] = await get_user_rank(redis, user_id, period)

    # Nearby entries (alltime ±5)
    alltime_key = get_period_key("alltime")
    rev_rank = await redis.zrevrank(alltime_key, user_id)
    nearby: list[dict[str, Any]] = []
    if rev_rank is not None:
        start = max(0, rev_rank - 5)
        end = rev_rank + 5
        nearby_raw: list[tuple[str, float]] = await redis.zrevrange(
            alltime_key, start, end, withscores=True
        )
        for idx, (uid, score) in enumerate(nearby_raw):
            meta_json = await redis.get(f"lb:user:{uid}")
            meta: dict[str, Any] = json.loads(meta_json) if meta_json else {}
            nearby.append({
                "rank": start + idx + 1,
                "user_id": uid,
                "display_name": meta.get("display_name", "Anonymous"),
                "level": meta.get("level", 1),
                "level_name": meta.get("level_name", "Novice"),
                "score": score,
                "is_self": uid == user_id,
            })

    summary["nearby"] = nearby
    return summary


async def rebuild_all(db: AsyncSession, redis: aioredis.Redis) -> dict[str, int]:
    """Rebuild all leaderboard sorted sets from the database (full mode, completed only)."""
    # Delete existing lb:* keys
    cursor: int = 0
    deleted = 0
    while True:
        cursor, keys = await redis.scan(cursor, match="lb:*", count=200)
        if keys:
            await redis.delete(*keys)
            deleted += len(keys)
        if cursor == 0:
            break

    # Query best scores per user (full mode, completed)
    query = text("""
        SELECT
            a.user_id,
            u.name,
            a.id as assessment_id,
            a.final_score,
            a.level,
            a.pillar_scores,
            a.completed_at,
            a.industry_id,
            a.role_id,
            b.id as badge_id
        FROM assessments a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN badges b ON b.assessment_id = a.id
        WHERE a.mode = 'full'
          AND a.status = 'completed'
          AND a.user_id IS NOT NULL
          AND a.final_score IS NOT NULL
        ORDER BY a.final_score DESC
    """)

    result = await db.execute(query)
    rows = result.fetchall()

    # Keep only the best score per user
    best: dict[str, Any] = {}
    for row in rows:
        uid = str(row.user_id)
        if uid not in best or row.final_score > best[uid]["score"]:
            best[uid] = {
                "user_id": uid,
                "name": row.name or "",
                "score": row.final_score,
                "level": row.level or 1,
                "pillar_scores": row.pillar_scores or {},
                "completed_at": row.completed_at.isoformat() if row.completed_at else "",
                "industry_id": str(row.industry_id) if row.industry_id else None,
                "role_id": str(row.role_id) if row.role_id else None,
                "badge_id": str(row.badge_id) if row.badge_id else None,
            }

    populated = 0
    for data in best.values():
        level = data["level"]
        level_name = LEVEL_NAMES.get(level, "Novice")
        await update_score(
            redis=redis,
            user_id=data["user_id"],
            score=data["score"],
            user_name=data["name"],
            level=level,
            level_name=level_name,
            pillar_scores=data["pillar_scores"],
            badge_id=data["badge_id"],
            achieved_at=data["completed_at"],
            industry_id=data["industry_id"],
            role_id=data["role_id"],
        )
        populated += 1

    now_iso = datetime.now(timezone.utc).isoformat()
    await redis.set("lb:meta:last_rebuild", now_iso)

    return {"deleted_keys": deleted, "users_populated": populated}

"""
Redis is a read-cache only. All data originates in Firestore. Redis outage = silent fallback, never a crash.
"""
import os
import json
import time
import structlog
from redis import asyncio as aioredis

logger = structlog.get_logger()

# ── Client setup ──────────────────────────────────────────────
_redis_client = None

# ── Identity cache ────────────────────────────────────────────
async def get_identity(uid: str) -> dict | None:
    if _redis_client is None:
        return None
    try:
        data = await _redis_client.get(f"identity:{uid}")
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.warning("redis_get_identity_error", error=str(e), uid=uid)
        return None

async def set_identity(uid: str, doc_id: str, role: str) -> None:
    if _redis_client is None:
        return None
    try:
        payload = json.dumps({"doc_id": doc_id, "role": role})
        await _redis_client.setex(f"identity:{uid}", 86400, payload)
    except Exception as e:
        logger.warning("redis_set_identity_error", error=str(e), uid=uid)

async def delete_identity(uid: str) -> None:
    if _redis_client is None:
        return None
    try:
        await _redis_client.delete(f"identity:{uid}")
    except Exception as e:
        logger.warning("redis_delete_identity_error", error=str(e), uid=uid)

# ── Priority list cache ───────────────────────────────────────
async def get_priority_list(asha_id: str) -> list | None:
    if _redis_client is None:
        return None
    try:
        data = await _redis_client.get(f"risk:priority:{asha_id}")
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.warning("redis_get_priority_list_error", error=str(e), asha_id=asha_id)
        return None

async def set_priority_list(asha_id: str, data: list) -> None:
    if _redis_client is None:
        return None
    try:
        payload = json.dumps(data)
        await _redis_client.setex(f"risk:priority:{asha_id}", 21600, payload)
    except Exception as e:
        logger.warning("redis_set_priority_list_error", error=str(e), asha_id=asha_id)

async def invalidate_priority(asha_id: str) -> None:
    if _redis_client is None:
        return None
    try:
        await _redis_client.delete(f"risk:priority:{asha_id}")
    except Exception as e:
        logger.warning("redis_invalidate_priority_error", error=str(e), asha_id=asha_id)

# ── Rate limiting ─────────────────────────────────────────────
async def check_rate_limit(uid: str, limit: int = 100, window_seconds: int = 60) -> bool:
    if _redis_client is None:
        return True  # Fail open if Redis is down
    try:
        now = time.time()
        key = f"ratelimit:{uid}"
        
        async with _redis_client.pipeline(transaction=True) as pipe:
            # 1. Remove old entries
            pipe.zremrangebyscore(key, 0, now - window_seconds)
            # 2. Add current request
            pipe.zadd(key, {str(now): now})
            # 3. Count in window
            pipe.zcount(key, now - window_seconds, now)
            # 4. Auto-cleanup
            pipe.expire(key, window_seconds * 2)
            
            results = await pipe.execute()
            
        count = results[2]
        return count <= limit
    except Exception as e:
        logger.warning("redis_check_rate_limit_error", error=str(e), uid=uid)
        return True  # Fail open to prevent API outage

# ── Ambient session ───────────────────────────────────────────
async def get_ambient_session(asha_id: str, session_id: str) -> dict | None:
    if _redis_client is None:
        return None
    try:
        data = await _redis_client.get(f"ambient:{asha_id}:{session_id}")
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.warning("redis_get_ambient_session_error", error=str(e), asha_id=asha_id, session_id=session_id)
        return None

async def set_ambient_session(asha_id: str, session_id: str, data: dict) -> None:
    if _redis_client is None:
        return None
    try:
        payload = json.dumps(data)
        await _redis_client.setex(f"ambient:{asha_id}:{session_id}", 1800, payload)
    except Exception as e:
        logger.warning("redis_set_ambient_session_error", error=str(e), asha_id=asha_id, session_id=session_id)

# ── Health check ──────────────────────────────────────────────
async def ping() -> bool:
    if _redis_client is None:
        return False
    try:
        return await _redis_client.ping()
    except Exception as e:
        logger.warning("redis_ping_error", error=str(e))
        return False

# ── Startup / shutdown ────────────────────────────────────────
async def init_redis() -> None:
    global _redis_client
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        logger.warning("redis_init_skipped", detail="REDIS_URL not set")
        return
        
    try:
        # decode_responses=True ensures we get strings back from Redis instead of bytes
        _redis_client = aioredis.from_url(redis_url, decode_responses=True)
        await _redis_client.ping()
        logger.info("redis_initialized_successfully")
    except Exception as e:
        logger.warning("redis_init_failed", error=str(e))
        _redis_client = None

async def close_redis() -> None:
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.close()
        except Exception as e:
            logger.warning("redis_close_error", error=str(e))
        finally:
            _redis_client = None

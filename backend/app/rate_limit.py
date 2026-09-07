"""
Lightweight in-memory rate limiter.

Mitigates brute-force login attempts and automated mass account creation.
This is intentionally simple (a per-process dict) and is suitable for local
development and single-instance deployments. If this app is later deployed
across multiple worker processes or instances, replace this with a shared
store such as Redis so limits are enforced consistently across all of them.
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, status

_attempts: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    with _lock:
        bucket = _attempts[key]
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()

        if len(bucket) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait a few minutes and try again.",
            )

        bucket.append(now)

"""Direct access to another service's database: local development only.

Services must talk through events and HTTP, never read each other's tables. A few shortcuts that did exactly that are kept
for running without Redis on a laptop; they are off unless LMS_DEV_CROSS_DB=1, and the address comes from LMS_DEV_DB_DSN
(a template with a {db} placeholder). In every other environment connecting raises, and each caller already treats a
failure as "fall back to the event-fed copy".
"""

import os
from typing import Any

_DEFAULT_DSN = "postgresql://lms:lms@127.0.0.1:5432/{db}"


async def connect(db_name: str) -> Any:
    if os.environ.get("LMS_DEV_CROSS_DB") != "1":
        raise RuntimeError("Cross-service database access is disabled (set LMS_DEV_CROSS_DB=1 for local development only).")
    import asyncpg

    return await asyncpg.connect(os.environ.get("LMS_DEV_DB_DSN", _DEFAULT_DSN).format(db=db_name))

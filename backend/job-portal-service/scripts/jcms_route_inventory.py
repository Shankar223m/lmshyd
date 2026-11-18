"""Emit JCMS facade route inventory for verification docs."""

from __future__ import annotations

import json
from collections import defaultdict

from app.api.v1.endpoints.jcms_facade import router


def main() -> None:
    rows = []
    for route in router.routes:
        methods = sorted(m for m in getattr(route, "methods", set()) or [] if m != "HEAD")
        path = getattr(route, "path", "")
        name = getattr(route, "name", "")
        for method in methods:
            rows.append({"method": method, "path": f"/api/v1{path}" if path.startswith("/jcms") else path, "handler": name})
    rows.sort(key=lambda r: (r["path"], r["method"]))
    by_method = defaultdict(int)
    for r in rows:
        by_method[r["method"]] += 1
    print(json.dumps({"count": len(rows), "by_method": dict(by_method), "routes": rows}, indent=2))


if __name__ == "__main__":
    main()

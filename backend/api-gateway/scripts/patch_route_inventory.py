"""Merge live OpenAPI path lists into route_inventory.json and rewrite routes.json (no per-service venvs).

Usage (from repo root, with stack running):
  python backend/api-gateway/scripts/patch_route_inventory.py --jcms <json-file> --job-portal <json-file>

Or pass paths inline via docker dumps saved to /tmp.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.proxy.routes import compile_rules, to_json  # noqa: E402

CONFIG = ROOT / "config"
INVENTORY = CONFIG / "route_inventory.json"
ROUTES = CONFIG / "routes.json"


def docker_paths(service: str) -> list[str]:
    cmd = [
        "docker",
        "exec",
        f"lms-backend-{service}-1",
        "python",
        "-c",
        "import json; from app.main import create_app; print(json.dumps(sorted(create_app().openapi()['paths'].keys())))"
        if service == "job-portal-service"
        else "import json, os; os.environ.setdefault('ENVIRONMENT','test'); from app.main import app; print(json.dumps(sorted(app.openapi()['paths'].keys())))",
    ]
    if service == "jcms-service":
        cmd[-1] = "import json, os; os.environ.setdefault('ENVIRONMENT','test'); from app.main import app; print(json.dumps(sorted(app.openapi()['paths'].keys())))"
    result = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=120)  # noqa: S603
    if result.returncode != 0:
        raise SystemExit(f"{service}: {result.stderr[-500:]}")
    return json.loads(result.stdout.strip())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-docker", action="store_true", help="Pull jcms-service and job-portal-service paths from running containers")
    args = parser.parse_args()

    data = json.loads(INVENTORY.read_text(encoding="utf-8"))
    services: dict[str, list[str]] = data["services"]

    if args.from_docker:
        jp = docker_paths("job-portal-service")
        services["job-portal-service"] = sorted(set(jp))
        jcms = docker_paths("jcms-service")
        services["jcms-service"] = sorted(set(p for p in jcms if p.startswith("/api/v1/jcms")))
        # Drop legacy /jcms facade paths from job-portal inventory (routed to jcms-service now).
        services["job-portal-service"] = sorted(
            p for p in services["job-portal-service"] if not p.startswith("/api/v1/jcms/")
        )

    data["services"] = services
    INVENTORY.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    pairs = [(path, name) for name, paths in services.items() for path in paths]
    routes = {"rules": to_json(compile_rules(pairs))}
    ROUTES.write_text(json.dumps(routes, indent=2) + "\n", encoding="utf-8")
    print(f"updated {INVENTORY.name} + {ROUTES.name} ({len(routes['rules'])} rules)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

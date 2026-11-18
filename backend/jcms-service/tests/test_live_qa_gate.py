"""Gate: full HTTP lifecycle on Docker PostgreSQL (jcms_test). Skip unless JCMS_RUN_LIVE_QA=1."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(os.getenv("JCMS_RUN_LIVE_QA") != "1", reason="Set JCMS_RUN_LIVE_QA=1 and run API on jcms_test")
def test_live_api_full_recruitment_lifecycle():
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "qa_live_api.py")],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr

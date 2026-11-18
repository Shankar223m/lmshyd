import csv
import io
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import User

REQUIRED_COLUMNS = {"email", "full_name", "program"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def parse_csv_text(raw: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames:
        raise ValueError("INVALID_CSV")
    headers = {h.strip().lower() for h in reader.fieldnames if h}
    if not REQUIRED_COLUMNS.issubset(headers):
        raise ValueError("MISSING_COLUMNS")
    rows: list[dict[str, str]] = []
    for row in reader:
        normalized = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}
        rows.append(normalized)
    return rows


def validate_import_rows(db: Session, rows: list[dict[str, Any]]) -> dict:
    seen: set[str] = set()
    preview_rows = []
    error_count = 0

    for idx, row in enumerate(rows, start=2):
        row_errors: list[str] = []
        email = (row.get("email") or "").strip().lower()
        full_name = (row.get("full_name") or "").strip()
        program = (row.get("program") or "").strip()

        if not email:
            row_errors.append("email is required")
        elif not EMAIL_RE.match(email):
            row_errors.append("invalid email format")
        elif email in seen:
            row_errors.append("duplicate email in file")
        else:
            seen.add(email)

        if not full_name:
            row_errors.append("full_name is required")
        if not program:
            row_errors.append("program is required")

        if email and db.scalar(select(User).where(User.email == email)):
            row_errors.append("email already registered")

        if row.get("graduation_year") and not str(row.get("graduation_year")).isdigit():
            row_errors.append("graduation_year must be a number")
        if row.get("cgpa"):
            try:
                float(row["cgpa"])
            except (TypeError, ValueError):
                row_errors.append("cgpa must be numeric")

        if row_errors:
            error_count += 1

        preview_rows.append(
            {
                "line": idx,
                "email": email,
                "full_name": full_name or row.get("full_name"),
                "program": program or row.get("program"),
                "department": row.get("department"),
                "batch": row.get("batch"),
                "errors": row_errors,
                "valid": len(row_errors) == 0,
            }
        )

    valid_rows = [row for row, p in zip(rows, preview_rows) if p["valid"]]

    return {
        "rows": preview_rows,
        "valid_count": len(valid_rows),
        "error_count": error_count,
        "total_rows": len(preview_rows),
        "valid_rows": valid_rows,
    }

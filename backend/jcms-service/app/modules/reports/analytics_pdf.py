from datetime import UTC, datetime
from io import BytesIO

from fpdf import FPDF


def build_institution_analytics_pdf(
    *,
    institution_name: str,
    metrics: dict[str, int | str],
) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", style="B", size=16)
    pdf.cell(0, 10, "Institution placement analytics", ln=True)
    pdf.set_font("Helvetica", size=10)
    pdf.cell(0, 8, institution_name[:80], ln=True)
    pdf.cell(0, 8, f"Generated {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}", ln=True)
    pdf.ln(4)

    pdf.set_font("Helvetica", style="B", size=11)
    pdf.cell(90, 8, "Metric", border=1)
    pdf.cell(40, 8, "Value", border=1, ln=True)
    pdf.set_font("Helvetica", size=11)

    for label, key in [
        ("Total students", "total_students"),
        ("Applications", "applications"),
        ("Shortlisted", "shortlisted"),
        ("Offers", "offers"),
        ("Verified placements", "placed"),
        ("Placement %", "placement_percentage"),
    ]:
        pdf.cell(90, 8, label, border=1)
        pdf.cell(40, 8, str(metrics.get(key, "")), border=1, ln=True)

    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()

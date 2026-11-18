"""Word (.docx) export of a resume, from the same document and template config as the PDF so the two match.

Single column, real text, standard headings and Word's own list-free bullets: nothing a parser or a person editing the file
in Word has to untangle. The template's standard PDF fonts are mapped to the Word fonts that look the same.
"""

from io import BytesIO
from typing import Any

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Mm, Pt, RGBColor

_FONTS = {"Times-Roman": "Times New Roman", "Helvetica": "Arial"}


def _rgb(hex_color: str) -> RGBColor:
    value = hex_color.lstrip("#")
    return RGBColor(int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


def _bottom_rule(paragraph: Any, color: str) -> None:
    border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    for key, value in (("w:val", "single"), ("w:sz", "4"), ("w:space", "1"), ("w:color", color.lstrip("#"))):
        bottom.set(qn(key), value)
    border.append(bottom)
    paragraph._p.get_or_add_pPr().append(border)  # noqa: SLF001


def render_docx(document: dict[str, Any], config: dict[str, Any], *, title: str) -> bytes:
    font = _FONTS.get(config.get("font", "Helvetica"), "Arial")
    size = float(config["size"])
    accent = _rgb(config.get("accent", "#000000"))
    centre = config.get("align") == "center"
    gap = Pt(float(config.get("space", 6)))

    doc = Document()
    doc.core_properties.title = title
    section = doc.sections[0]
    section.page_width, section.page_height = Mm(210), Mm(297)
    section.left_margin = section.right_margin = Mm(18)
    section.top_margin = section.bottom_margin = Mm(15)
    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size = font, Pt(size)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), font)
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.line_spacing = float(config.get("leading", 1.2))

    def paragraph(text: str = "", *, bold: bool = False, italic: bool = False, pt: float | None = None, color: RGBColor | None = None, align: Any = None, before: Pt | None = None, indent: bool = False) -> Any:
        p = doc.add_paragraph()
        if align is not None:
            p.alignment = align
        if before is not None:
            p.paragraph_format.space_before = before
        if indent:
            p.paragraph_format.left_indent = Mm(4)
            p.paragraph_format.first_line_indent = Mm(-3)
        if text:
            run = p.add_run(text)
            run.bold, run.italic = bold, italic
            if pt:
                run.font.size = Pt(pt)
            if color is not None:
                run.font.color.rgb = color
        return p

    def heading(text: str) -> None:
        p = paragraph(text.upper(), bold=True, pt=float(config["heading_size"]), color=accent, before=gap)
        if config.get("rule"):
            _bottom_rule(p, config.get("accent", "#000000"))

    align = WD_ALIGN_PARAGRAPH.CENTER if centre else WD_ALIGN_PARAGRAPH.LEFT
    personal = document["personal"]
    paragraph(personal["name"], bold=True, pt=float(config["name_size"]), align=align)
    if personal.get("headline"):
        paragraph(personal["headline"], pt=size, align=align)
    bits = [b for b in (personal.get("email"), personal.get("phone"), personal.get("location"), *[link["url"] for link in personal.get("links", [])]) if b]
    if bits:
        paragraph("  |  ".join(bits), pt=size - 0.5, align=align)
    if document.get("summary"):
        heading("Summary")
        paragraph(document["summary"])
    for block in document["sections"]:
        heading(block["title"])
        if block["key"] == "skills":
            paragraph(", ".join(entry["heading"] for entry in block["entries"]))
            continue
        for entry in block["entries"]:
            line = entry["heading"] + (f" - {entry['subheading']}" if entry.get("subheading") and block["key"] in {"experience", "education"} else "")
            right = "  ·  ".join(x for x in (entry.get("dates"), entry.get("location")) if x)
            p = paragraph(line, bold=True, before=Pt(3))
            if right:
                run = p.add_run(f"  ({right})")
                run.font.size = Pt(size - 0.5)
            for bullet in entry["bullets"]:
                paragraph(f"•  {bullet}", indent=True)
    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()

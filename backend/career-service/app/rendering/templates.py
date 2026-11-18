"""Resume templates. Every one is single-column, text-only (no tables, images or text boxes — the things that scramble an
applicant tracking system's reading order) and uses the standard section headings. They differ only in typography and spacing.
``ats_safe`` is a property of the template's structure: a future template that breaks these rules must set it false, and the
ATS score then says so.
"""

from typing import Any

DEFAULT_TEMPLATES: dict[str, dict[str, Any]] = {
    "classic": {
        "name": "Classic",
        "description": "Serif, centred name, ruled section headings. The safe default for most roles.",
        "config": {"font": "Times-Roman", "bold": "Times-Bold", "italic": "Times-Italic", "size": 10.5, "name_size": 20, "heading_size": 11.5, "align": "center", "rule": True, "accent": "#000000", "leading": 1.25, "space": 7},
    },
    "modern": {
        "name": "Modern",
        "description": "Sans-serif, left-aligned name, a single accent colour on headings.",
        "config": {"font": "Helvetica", "bold": "Helvetica-Bold", "italic": "Helvetica-Oblique", "size": 10, "name_size": 22, "heading_size": 11, "align": "left", "rule": False, "accent": "#1f4e79", "leading": 1.3, "space": 8},
    },
    "compact": {
        "name": "Compact",
        "description": "Tighter spacing to keep a longer resume on one page.",
        "config": {"font": "Helvetica", "bold": "Helvetica-Bold", "italic": "Helvetica-Oblique", "size": 9, "name_size": 17, "heading_size": 10, "align": "left", "rule": True, "accent": "#000000", "leading": 1.2, "space": 4},
    },
    "minimal": {
        "name": "Minimal",
        "description": "Plenty of white space, no rules, one dark grey accent. Lets the content speak.",
        "config": {"font": "Helvetica", "bold": "Helvetica-Bold", "italic": "Helvetica-Oblique", "size": 10, "name_size": 20, "heading_size": 10.5, "align": "left", "rule": False, "accent": "#374151", "leading": 1.4, "space": 10},
    },
    "professional": {
        "name": "Professional",
        "description": "Serif body with a navy accent and ruled headings. Suits experienced and corporate roles.",
        "config": {"font": "Times-Roman", "bold": "Times-Bold", "italic": "Times-Italic", "size": 10.5, "name_size": 21, "heading_size": 11.5, "align": "left", "rule": True, "accent": "#1e3a5f", "leading": 1.28, "space": 7},
    },
    "technical": {
        "name": "Technical",
        "description": "Dense and tidy with a teal accent: more room for skills, projects and tools.",
        "config": {"font": "Helvetica", "bold": "Helvetica-Bold", "italic": "Helvetica-Oblique", "size": 9.5, "name_size": 19, "heading_size": 10.5, "align": "left", "rule": True, "accent": "#0f766e", "leading": 1.22, "space": 5},
    },
    "creative": {
        "name": "Creative",
        "description": "A bolder name and a warm accent colour, still a single plain column that a parser reads in order.",
        "config": {"font": "Helvetica", "bold": "Helvetica-Bold", "italic": "Helvetica-Oblique", "size": 10, "name_size": 26, "heading_size": 12, "align": "left", "rule": False, "accent": "#c2410c", "leading": 1.3, "space": 9},
    },
}
DEFAULT_TEMPLATE_KEY = "classic"


_FAMILIES = {
    "serif": {"font": "Times-Roman", "bold": "Times-Bold", "italic": "Times-Italic"},
    "sans": {"font": "Helvetica", "bold": "Helvetica-Bold", "italic": "Helvetica-Oblique"},
}


def apply_style(config: dict[str, Any], style: dict[str, Any] | None) -> dict[str, Any]:
    """The template's config with the owner's look on top: colour, font family, text size and spacing. A missing or
    out-of-range value is ignored, so a bad stored style can never break an export."""
    out = dict(config)
    style = style or {}
    accent = style.get("accent")
    if isinstance(accent, str) and len(accent) == 7 and accent.startswith("#"):
        try:
            int(accent[1:], 16)
            out["accent"] = accent
        except ValueError:
            pass
    if style.get("font") in _FAMILIES:
        out.update(_FAMILIES[style["font"]])
    scale = style.get("font_scale")
    if isinstance(scale, int | float) and 0.85 <= scale <= 1.2:
        for key in ("size", "name_size", "heading_size"):
            out[key] = round(float(config[key]) * float(scale), 2)
    spacing = style.get("spacing_scale")
    if isinstance(spacing, int | float) and 0.8 <= spacing <= 1.5:
        out["space"] = round(float(config["space"]) * float(spacing), 2)
        out["leading"] = round(float(config["leading"]) * (1 + (float(spacing) - 1) / 2), 3)
    return out

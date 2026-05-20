from datetime import datetime
from html import escape
import os
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models import SystemSettings
from app.utils.pdf_gen import html_to_pdf_with_browser


def money(value) -> str:
    try:
        return f"₹{float(value or 0):,.2f}"
    except Exception:
        return "₹0.00"


def qty(value, places: int = 3) -> str:
    try:
        return f"{float(value or 0):.{places}f}"
    except Exception:
        return f"{0:.{places}f}"


def table_html(headers: list[str], rows: list[list[object]], aligns: list[str] | None = None) -> str:
    aligns = aligns or ["left"] * len(headers)
    head = "".join(
        f'<th class="{_align_class(aligns[idx])}">{escape(str(header))}</th>'
        for idx, header in enumerate(headers)
    )
    body_rows = []
    for row in rows:
        cells = "".join(
            f'<td class="{_align_class(aligns[idx])}">{escape(str(value if value is not None else "-"))}</td>'
            for idx, value in enumerate(row)
        )
        body_rows.append(f"<tr>{cells}</tr>")
    body = "".join(body_rows) or f'<tr><td colspan="{len(headers)}" class="c empty">No data found</td></tr>'
    return f"""
      <table class="report-table">
        <thead><tr>{head}</tr></thead>
        <tbody>{body}</tbody>
      </table>
    """


def render_report_pdf(
    db: Session,
    title: str,
    body_html: str,
    subtitle: str | None = None,
    orientation: str = "landscape",
) -> bytes:
    settings = db.query(SystemSettings).first()
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    logo_path = _resolve_logo_path(settings, project_root)

    def is_visible(field_name: str) -> bool:
        return bool(getattr(settings, field_name, True)) if settings else True

    temple_name = settings.temple_name if settings and settings.temple_name else "Anegudde Sri Vinayaka Temple"
    temple_name_kn = settings.temple_name_kn if settings and settings.temple_name_kn else ""
    temple_address = settings.temple_address if settings and settings.temple_address else ""
    temple_contact = settings.temple_contact if settings and settings.temple_contact else ""
    alternate_contact = settings.alternate_contact if settings and settings.alternate_contact else ""

    contact_parts = []
    if is_visible("show_temple_contact") and temple_contact:
        contact_parts.append(temple_contact)
    if is_visible("show_alternate_contact") and alternate_contact:
        contact_parts.append(alternate_contact)

    html_content = f"""
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page {{ size: A4 {orientation}; margin: 10mm; }}
          body {{
            font-family: "Nirmala UI", "Nirmala", "Segoe UI", Arial, sans-serif;
            color: #2b1d17;
            font-size: 10px;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }}
          .report-header {{ text-align: center; border-bottom: 2px solid #5A2D1F; padding-bottom: 10px; margin-bottom: 12px; }}
          .report-logo {{ height: 58px; margin-bottom: 5px; }}
          .temple-kn {{ font-size: 20px; font-weight: 800; color: #5A2D1F; margin: 0; }}
          .temple-en {{ font-size: 13px; font-weight: 800; text-transform: uppercase; margin: 2px 0; }}
          .temple-info {{ font-size: 9px; color: #4B4B4B; margin: 1px 0; }}
          .report-title {{ text-align: center; margin: 10px 0 12px; }}
          .report-title h1 {{ font-size: 14px; margin: 0; text-transform: uppercase; text-decoration: underline; }}
          .report-title .subtitle {{ margin-top: 3px; font-size: 10px; font-weight: 700; }}
          .report-table {{ width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 12px; }}
          .report-table th {{ background: #FAF7F2; color: #5A2D1F; border: 1px solid #E7D8CC; padding: 5px 4px; font-size: 8px; text-transform: uppercase; }}
          .report-table td {{ border: 1px solid #E7D8CC; padding: 5px 4px; font-size: 9px; vertical-align: top; word-wrap: break-word; }}
          .section-title {{ background: #FAF7F2; border: 1px solid #E7D8CC; color: #5A2D1F; font-weight: 800; padding: 5px 7px; text-transform: uppercase; margin-top: 10px; }}
          .summary-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }}
          .summary-box {{ border: 1px solid #E7D8CC; padding: 8px; background: #FFFDFB; break-inside: avoid; }}
          .summary-row {{ display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px solid #FAF7F2; padding: 2px 0; }}
          .r {{ text-align: right; }}
          .c {{ text-align: center; }}
          .empty {{ padding: 16px !important; color: #777; }}
          .report-footer {{ margin-top: 18px; border-top: 1px solid #FAF7F2; padding-top: 8px; text-align: center; color: #777; font-size: 8px; font-style: italic; }}
        </style>
      </head>
      <body>
        <div class="report-header">
          {f'<img src="{logo_path}" class="report-logo" />' if logo_path else ''}
          {f'<div class="temple-kn">{escape(temple_name_kn)}</div>' if is_visible("show_temple_name_kn") and temple_name_kn else ''}
          {f'<div class="temple-en">{escape(temple_name)}</div>' if is_visible("show_temple_name") else ''}
          {f'<div class="temple-info">{escape(temple_address)}</div>' if is_visible("show_temple_address") and temple_address else ''}
          {f'<div class="temple-info">Contact: {escape(" / ".join(contact_parts))}</div>' if contact_parts else ''}
        </div>
        <div class="report-title">
          <h1>{escape(title)}</h1>
          {f'<div class="subtitle">{escape(subtitle)}</div>' if subtitle else ''}
        </div>
        {body_html}
        <div class="report-footer">Generated by Anegudde Inventory Management System on {datetime.now().strftime('%d-%m-%Y %I:%M %p')}</div>
      </body>
    </html>
    """
    return html_to_pdf_with_browser(html_content, project_root)


def _align_class(align: str) -> str:
    return "r" if align == "right" else "c" if align == "center" else ""


def _resolve_logo_path(settings: SystemSettings | None, project_root: str) -> str:
    if settings and settings.temple_logo:
        relative_logo = str(settings.temple_logo).lstrip("/\\")
        for candidate in (
            Path(project_root) / "backend" / relative_logo,
            Path(project_root) / relative_logo,
        ):
            if candidate.exists():
                return candidate.resolve().as_uri()

    permanent_logo = Path(project_root) / "frontend" / "public" / "temple-logo-permanent.png"
    if permanent_logo.exists():
        return permanent_logo.resolve().as_uri()
    return ""

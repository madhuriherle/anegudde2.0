import os
import uuid
import subprocess
from pathlib import Path
from html import escape

CHROMIUM_PATHS = [
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

def find_chromium() -> str | None:
    return next((path for path in CHROMIUM_PATHS if os.path.exists(path)), None)

def html_to_pdf_with_browser(html_content: str, project_root: str = None) -> bytes:
    if not project_root:
        # Default to 4 levels up from this file: backend/app/utils/pdf_gen.py -> backend/app/utils -> backend/app -> backend -> root
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
    
    browser_path = find_chromium()
    if not browser_path:
        raise RuntimeError("Chrome or Edge is required to generate Kannada PDF reports")

    temp_root = Path(project_root) / "backend" / ".pdf_tmp"
    temp_root.mkdir(parents=True, exist_ok=True)
    work_dir = temp_root / uuid.uuid4().hex
    work_dir.mkdir()

    try:
        html_path = work_dir / "report.html"
        pdf_path = work_dir / "report.pdf"
        user_data_dir = work_dir / "chrome-profile"
        cache_dir = work_dir / "chrome-cache"
        user_data_dir.mkdir()
        cache_dir.mkdir()
        html_path.write_text(html_content, encoding="utf-8")

        import shutil
        result = subprocess.run(
            [
                browser_path,
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--disable-crash-reporter",
                "--disable-crashpad",
                "--disable-extensions",
                f"--user-data-dir={user_data_dir}",
                f"--disk-cache-dir={cache_dir}",
                f"--print-to-pdf={pdf_path}",
                "--print-to-pdf-no-header",
                "--no-pdf-header-footer",
                str(html_path),
            ],
            capture_output=True,
            text=True,
            timeout=45,
        )

        if result.returncode != 0 or not pdf_path.exists():
            raise RuntimeError(f"Browser PDF generation failed: {result.stderr or result.stdout}")

        pdf_bytes = pdf_path.read_bytes()
        return pdf_bytes
    finally:
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)

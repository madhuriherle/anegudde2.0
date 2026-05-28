import os
import io
from xhtml2pdf import pisa

def html_to_pdf_with_browser(html_content: str, project_root: str = None) -> bytes:
    """
    Simple version using xhtml2pdf (pisa) which doesn't require a browser.
    """
    result = io.BytesIO()
    # Create the PDF
    pdf = pisa.pisaDocument(io.BytesIO(html_content.encode("utf-8")), result)
    
    if pdf.err:
        raise RuntimeError(f"xhtml2pdf generation failed: {pdf.err}")
        
    return result.getvalue()

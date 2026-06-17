#!/usr/bin/env python3
"""
Printer Agent — local HTTP service that enumerates Windows printers
and prints PDFs directly to a named printer.
Runs on http://localhost:5623
"""

import json
import os
import sys
import tempfile
import base64
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

try:
    import win32print
    import win32api
    import win32con
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

PORT = 5623
AGENT_NAME = 'opencode-printer-agent'

PRINTER_STATUS_FLAGS = (
    (0x00000080, 'Offline'),
    (0x00000001, 'Paused'),
    (0x00000002, 'Error'),
    (0x00000400, 'Printing'),
    (0x00000200, 'Busy'),
    (0x00000004, 'Pending deletion'),
    (0x00000008, 'Paper jam'),
    (0x00000010, 'Paper out'),
    (0x00000020, 'Manual feed'),
    (0x00000040, 'Paper problem'),
    (0x00000100, 'I/O active'),
    (0x00000800, 'Output bin full'),
    (0x00001000, 'Not available'),
    (0x00002000, 'Waiting'),
    (0x00004000, 'Processing'),
    (0x00008000, 'Initializing'),
    (0x00010000, 'Warming up'),
    (0x00020000, 'Toner low'),
    (0x00040000, 'No toner'),
    (0x00080000, 'Page punt'),
    (0x00100000, 'User intervention required'),
    (0x00200000, 'Out of memory'),
    (0x00400000, 'Door open'),
    (0x00800000, 'Server unknown'),
    (0x01000000, 'Power save'),
)

BLOCKING_STATUS_FLAGS = (
    0x00000080,  # offline
    0x00000001,  # paused
    0x00000002,  # error
    0x00000004,  # pending deletion
    0x00000008,  # paper jam
    0x00000010,  # paper out
    0x00001000,  # not available
    0x00100000,  # user intervention required
    0x00400000,  # door open
)

VIRTUAL_PRINTER_NAMES = (
    'microsoft print to pdf',
    'microsoft xps document writer',
    'onenote',
    'fax',
)


def is_virtual_printer(name):
    normalized = (name or '').strip().lower()
    return any(virtual_name in normalized for virtual_name in VIRTUAL_PRINTER_NAMES)


def get_printer_status(name, default_printer=''):
    status = 0
    status_text = 'Ready'
    details = []
    is_virtual = is_virtual_printer(name)

    try:
        handle = win32print.OpenPrinter(name)
        try:
            info = win32print.GetPrinter(handle, 2)
            status = int(info.get('Status') or 0)
        finally:
            win32print.ClosePrinter(handle)
    except Exception as exc:
        return {
            'name': name,
            'is_default': name == default_printer,
            'is_virtual': is_virtual,
            'is_online': False,
            'status': None,
            'status_text': f'Unavailable: {exc}',
            'details': ['Unavailable'],
        }

    if status:
        details = [label for bit, label in PRINTER_STATUS_FLAGS if status & bit]
        status_text = ', '.join(details) if details else f'Status {status}'

    is_online = is_virtual or not any(status & bit for bit in BLOCKING_STATUS_FLAGS)
    return {
        'name': name,
        'is_default': name == default_printer,
        'is_virtual': is_virtual,
        'is_online': is_online,
        'status': status,
        'status_text': 'Virtual printer' if is_virtual and status_text == 'Ready' else status_text,
        'details': ['Virtual'] if is_virtual and not details else details,
    }


class PrinterAgentHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        sys.stderr.write(f'[{AGENT_NAME}] {args[0]} {args[1]} {args[2]}\n')

    # ── helpers ──────────────────────────────────────────────────

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '86400')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, html, status=200):
        body = html.encode()
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length) if length else b''

    # ── routes ───────────────────────────────────────────────────

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path == '/api/health':
            self._send_json({
                'status': 'ok',
                'agent': AGENT_NAME,
                'version': '1.0.0',
                'win32_available': HAS_WIN32,
            })

        elif path == '/api/printers':
            if not HAS_WIN32:
                self._send_json({'error': 'win32print not available — install pywin32'}, 500)
                return
            try:
                printers = []
                flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
                for p in win32print.EnumPrinters(flags):
                    name = p[2]
                    if name:
                        printers.append(name)
                default = ''
                try:
                    default = win32print.GetDefaultPrinter()
                except Exception:
                    pass
                printer_details = [get_printer_status(name, default) for name in printers]
                self._send_json({
                    'printers': printers,
                    'printer_details': printer_details,
                    'active_printers': [
                        printer['name']
                        for printer in printer_details
                        if printer['is_online']
                    ],
                    'default': default,
                })
            except Exception as e:
                self._send_json({'error': f'Failed to enumerate printers: {e}'}, 500)

        elif path == '/':
            self._send_html(f'''<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Printer Agent</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; }}
  h1 {{ font-size: 1.4rem; }}
  .ok {{ color: #16a34a; font-weight: bold; }}
  .endpoint {{ background: #f5f5f5; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 0.9rem; }}
  .info {{ color: #555; }}
</style></head>
<body>
  <h1>Printer Agent <span class="ok">&#9679; Running</span></h1>
  <p class="info">Listening on port {PORT}</p>
  <hr>
  <h2>Endpoints</h2>
  <ul>
    <li><span class="endpoint">GET /api/health</span> — health check</li>
    <li><span class="endpoint">GET /api/printers</span> — list installed printers</li>
    <li><span class="endpoint">POST /api/print</span> — print a PDF <span class="info">(json: printer_name, pdf_base64, filename)</span></li>
  </ul>
</body></html>''')

        else:
            self._send_json({'error': 'Not found'}, 404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path == '/api/print':
            if not HAS_WIN32:
                self._send_json({'error': 'win32print not available — install pywin32'}, 500)
                return

            body = self._read_body()
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                self._send_json({'error': 'Invalid JSON body'}, 400)
                return

            printer_name = data.get('printer_name', '')
            pdf_base64 = data.get('pdf_base64', '')
            filename = data.get('filename', 'print.pdf')

            if not pdf_base64:
                self._send_json({'error': 'pdf_base64 is required'}, 400)
                return

            try:
                pdf_data = base64.b64decode(pdf_base64)
            except Exception:
                self._send_json({'error': 'Invalid base64 encoding'}, 400)
                return

            # Write to temp file
            tmp_path = os.path.join(tempfile.gettempdir(), filename)
            try:
                with open(tmp_path, 'wb') as f:
                    f.write(pdf_data)
            except IOError as e:
                self._send_json({'error': f'Failed to write temp file: {e}'}, 500)
                return

            try:
                if printer_name:
                    verb = 'printto'
                    params = f'"{printer_name}"'
                else:
                    verb = 'print'
                    params = None

                win32api.ShellExecute(0, verb, tmp_path, params, '.', win32con.SW_HIDE)
                target = printer_name or 'default printer'
                self._send_json({'status': 'ok', 'message': f'Sent to {target}'})
            except Exception as e:
                self._send_json({'error': f'Print failed: {e}'}, 500)
            finally:
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
        else:
            self._send_json({'error': 'Not found'}, 404)


def main():
    banner = f'''
 ╔══════════════════════════════════════════════╗
 ║         Printer Agent                        ║
 ║  Listening on http://localhost:{PORT}        ║
 ╚══════════════════════════════════════════════╝
  Endpoints:
    GET  /api/health     Health check
    GET  /api/printers   List installed printers
    POST /api/print      Print PDF to a specific printer
'''
    print(banner)
    if not HAS_WIN32:
        print(' [!] pywin32 not found — printer listing & printing disabled')
        print('     Install with: pip install pywin32\n')

    server = HTTPServer(('', PORT), PrinterAgentHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopping...')
        server.server_close()


if __name__ == '__main__':
    main()

import paramiko, os, sys, io

hostname = "187.127.173.27"
username = "root"
password = "D-apps@123456"
remote_base = "/var/www/anegudde"
local_base = r"D:\python_project\anegudde\Anegudde_Inventory_System_RemoteAccess"

files = [
    "backend/app/api/dashboard/canteen_summary.py",
    "backend/app/api/dashboard/today.py",
    "backend/app/api/purchases/upload_bill.py",
    "backend/app/api/reports/stock_summary.py",
    "backend/app/db/models.py",
    "backend/app/schemas/item.py",
    "backend/app/schemas/menu_item.py",
    "backend/app/schemas/stock_adjustment.py",
    "backend/app/schemas/consumption.py",
    "backend/app/services/item_service.py",
    "backend/app/services/wastage_service.py",
    "backend/app/services/consumption_service.py",
    "backend/app/api/stock_adjustments/__init__.py",
    "backend/app/api/stock_adjustments/adjust.py",
    "frontend/src/components/Footer.jsx",
    "frontend/src/layouts/MainLayout.jsx",
    "frontend/src/pages/ItemsPage.jsx",
    "frontend/src/pages/MenuItemsPage.jsx",
    "frontend/src/pages/UsageEntriesPage.jsx",
    "frontend/src/pages/WastagesPage.jsx",
    "token_desktop_app/lib/services/printing_service.dart",
    "backend/alembic/versions/5a8099632da1_add_default_approx_amount_to_menu_items.py",
    "backend/alembic/versions/d4bb768c6c82_add_opening_price_column_to_items.py",
]

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(hostname, username=username, password=password)
sftp = ssh.open_sftp()

def sftp_mkdir_p(path):
    parts = path.strip("/").split("/")
    current = ""
    for p in parts:
        current += "/" + p
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)

for f in files:
    local = os.path.join(local_base, f)
    remote = os.path.join(remote_base, f).replace("\\", "/")
    remote_dir = os.path.dirname(remote)
    print(f"Uploading {f}...")
    sftp_mkdir_p(remote_dir)
    sftp.put(local, remote)
    print(f"  OK")

sftp.close()

# Run migration
print("\nRunning alembic migration...")
stdin, stdout, stderr = ssh.exec_command(f"cd {remote_base}/backend && .venv/bin/alembic upgrade head", timeout=30)
out = stdout.read().decode("utf-8", errors="replace").strip()
err = stderr.read().decode("utf-8", errors="replace").strip()
if out: print(out)
if err: print(f"ERR: {err}")

# Rebuild frontend
print("\nRebuilding frontend...")
stdin, stdout, stderr = ssh.exec_command(f"cd {remote_base}/frontend && npm run build", timeout=120)
out = stdout.read().decode("utf-8", errors="replace").strip()
err = stderr.read().decode("utf-8", errors="replace").strip()
if out: print(out)
if err: print(f"ERR: {err}")

# Upload stock update script
local_update = os.path.join(local_base, "update_vps_stocks.py")
remote_update = os.path.join(remote_base, "update_vps_stocks.py").replace("\\", "/")
print("\nUploading stock update script...")
sftp2 = ssh.open_sftp()
sftp2.put(local_update, remote_update)
sftp2.close()
print("  OK")

# Run stock update
print("\nUpdating item stocks...")
stdin, stdout, stderr = ssh.exec_command(f"cd {remote_base}/backend && .venv/bin/python ../update_vps_stocks.py", timeout=30)
out = stdout.read().decode("utf-8", errors="replace").strip()
err = stderr.read().decode("utf-8", errors="replace").strip()
if out: print(out)
if err: print(f"ERR: {err}")

# Restart backend
print("\nRestarting backend...")
stdin, stdout, stderr = ssh.exec_command("supervisorctl restart anegudde-backend", timeout=10)
out = stdout.read().decode("utf-8", errors="replace").strip()
err = stderr.read().decode("utf-8", errors="replace").strip()
if out: print(out)
if err: print(f"ERR: {err}")

ssh.close()
print("\nDeploy complete")

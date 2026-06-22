import paramiko
import os
import sys

hostname = "187.127.173.27"
username = "root"
password = "D-apps@123456"

local_base = r"D:\python_project\anegudde\Anegudde_Inventory_System_RemoteAccess"
remote_base = "/var/www/anegudde"

def safe_print(value):
    encoding = sys.stdout.encoding or "utf-8"
    print(str(value).encode(encoding, errors="replace").decode(encoding, errors="replace"))


def run_command(ssh, command):
    safe_print(f"Executing: {command}")
    stdin, stdout, stderr = ssh.exec_command(command)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if out: safe_print(out)
    if err: safe_print(f"Error: {err}")
    return exit_status, out, err

def upload_dir(sftp, local_dir, remote_dir):
    try:
        sftp.mkdir(remote_dir)
    except IOError:
        pass
    for item in os.listdir(local_dir):
        if item in ['.env', '.venv', 'node_modules', 'dist', '__pycache__', '.git', 'uploads']:
            continue
        local_path = os.path.join(local_dir, item)
        remote_path = f"{remote_dir}/{item}"
        if os.path.isfile(local_path):
            print(f"Uploading {local_path}")
            sftp.put(local_path, remote_path)
        elif os.path.isdir(local_path):
            upload_dir(sftp, local_path, remote_path)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(hostname, username=username, password=password)
sftp = ssh.open_sftp()

print("--- Uploading Latest Backend ---")
upload_dir(sftp, os.path.join(local_base, "backend"), f"{remote_base}/backend")

print("--- Uploading Latest Frontend ---")
upload_dir(sftp, os.path.join(local_base, "frontend"), f"{remote_base}/frontend")

print("--- Cleaning Remote Root ---")
remote_cleanup_cmd = (
    f"cd {remote_base} && rm -f check_*.py db_add_profile_module.py db_add_profile_module_v2.py "
    "list_databases.py list_db_users.py fix_today_receipts.py fix_today_receipts_v2.py "
    "fix_today_receipts_v3.py fix_units_module.py fix.sql debug_supervisor.py "
    "debug_supervisor_v2.py test_bcrypt.py test_db_conn_3.py test.db find_hidden_endpoints.py"
)
run_command(ssh, remote_cleanup_cmd)

print("--- Uploading Rename Roles Script ---")
sftp.put(os.path.join(local_base, "rename_roles.py"), f"{remote_base}/rename_roles.py")
print("--- Renaming Roles ---")
run_command(ssh, f"cd {remote_base} && backend/.venv/bin/python rename_roles.py")

print("--- Uploading Reassign User Records Script ---")
sftp.put(os.path.join(local_base, "reassign_user_records.py"), f"{remote_base}/reassign_user_records.py")
print("--- Reassigning User Records ---")
run_command(ssh, f"cd {remote_base} && backend/.venv/bin/python reassign_user_records.py")

print("--- Uploading Sidebar Fixes Script ---")
sftp.put(os.path.join(local_base, "fix_sidebar.py"), f"{remote_base}/fix_sidebar.py")
print("--- Applying Sidebar Fixes ---")
run_command(ssh, f"cd {remote_base} && backend/.venv/bin/python fix_sidebar.py")

print("--- Rebuilding and Restarting ---")
run_command(ssh, f"cd {remote_base}/backend && .venv/bin/alembic upgrade head")
run_command(ssh, f"cd {remote_base}/frontend && npm run build")
run_command(ssh, "systemctl restart anegudde-backend")
run_command(ssh, "systemctl restart nginx")

sftp.close()
ssh.close()
print("Synchronization complete.")

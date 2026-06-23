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
    safe_print(f"Executing on VPS: {command}")
    stdin, stdout, stderr = ssh.exec_command(command)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if out: safe_print(out)
    if err: safe_print(f"Error: {err}")
    return exit_status, out, err

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname, username=username, password=password)
    sftp = ssh.open_sftp()

    print("--- Uploading reconciliation script to VPS ---")
    sftp.put(os.path.join(local_base, "reconcile_stock_ledger.py"), f"{remote_base}/reconcile_stock_ledger.py")

    print("--- Running reconciliation on VPS ---")
    run_command(ssh, f"cd {remote_base} && backend/.venv/bin/python reconcile_stock_ledger.py")

    sftp.close()
    ssh.close()
    print("VPS reconciliation complete.")

if __name__ == "__main__":
    main()

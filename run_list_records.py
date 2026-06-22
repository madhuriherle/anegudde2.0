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

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(hostname, username=username, password=password)
sftp = ssh.open_sftp()

print("--- Uploading list_user_records.py ---")
sftp.put(os.path.join(local_base, "list_user_records.py"), f"{remote_base}/list_user_records.py")

print("--- Running list_user_records.py (output to file) ---")
run_command(ssh, f"cd {remote_base} && backend/.venv/bin/python list_user_records.py > /tmp/list_records_output.txt 2>&1")
print("--- Reading output file ---")
run_command(ssh, f"cat /tmp/list_records_output.txt")

sftp.close()
ssh.close()
print("Done.")

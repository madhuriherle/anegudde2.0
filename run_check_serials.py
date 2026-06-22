import paramiko, os, sys

hostname = "187.127.173.27"
username = "root"
password = "D-apps@123456"
local_base = r"D:\python_project\anegudde\Anegudde_Inventory_System_RemoteAccess"
remote_base = "/var/www/anegudde"

def safe_print(value):
    enc = sys.stdout.encoding or "utf-8"
    print(str(value).encode(enc, errors="replace").decode(enc, errors="replace"))

def run_command(ssh, command):
    stdin, stdout, stderr = ssh.exec_command(command)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if out: safe_print(out)
    if err: safe_print(f"Error: {err}")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(hostname, username=username, password=password)
sftp = ssh.open_sftp()

sftp.put(os.path.join(local_base, "check_serials.py"), f"{remote_base}/check_serials.py")
run_command(ssh, f"cd {remote_base} && backend/.venv/bin/python check_serials.py")

sftp.close()
ssh.close()

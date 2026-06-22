import paramiko
import os

hostname = "187.127.173.27"
username = "root"
password = "D-apps@123456"

local_path = r"D:\python_project\anegudde\Anegudde_Inventory_System_RemoteAccess\check_logs.py"
remote_path = "/var/www/anegudde/check_logs.py"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(hostname, username=username, password=password)

sftp = ssh.open_sftp()
print("Uploading check_logs.py...")
sftp.put(local_path, remote_path)
sftp.close()

print("Executing check_logs.py on VPS...")
stdin, stdout, stderr = ssh.exec_command("cd /var/www/anegudde && backend/.venv/bin/python check_logs.py")
out = stdout.read().decode("utf-8")
err = stderr.read().decode("utf-8")

if out:
    print(out)
if err:
    print("Error:", err)

ssh.close()

import zipfile, os, paramiko

dist = r'D:\python_project\anegudde\Anegudde_Inventory_System_RemoteAccess\frontend\dist'
zip_path = r'D:\python_project\anegudde\Anegudde_Inventory_System_RemoteAccess\frontend\dist5.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(dist):
        for f in files:
            full = os.path.join(root, f)
            arcname = os.path.relpath(full, dist).replace(os.sep, '/')
            z.write(full, arcname)

hostname = '187.127.173.27'
username = 'root'
password = 'D-apps@123456'
remote_base = '/var/www/anegudde'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(hostname, username=username, password=password)
sftp = ssh.open_sftp()
sftp.put(zip_path, remote_base + '/frontend/dist5.zip')
sftp.close()

for cmd in [
    'rm -rf ' + remote_base + '/frontend/dist',
    'mkdir ' + remote_base + '/frontend/dist',
    'cd ' + remote_base + '/frontend/dist && python3 -c "import zipfile; z=zipfile.ZipFile(\'../dist5.zip\'); z.extractall(); z.close()"',
    'rm ' + remote_base + '/frontend/dist5.zip',
]:
    ssh.exec_command(cmd, timeout=30)

ssh.close()
os.remove(zip_path)
print('Done')

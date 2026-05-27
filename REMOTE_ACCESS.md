# Remote Access

Run these two commands in separate PowerShell windows:

```powershell
cd D:\python_project\anegudde\Anegudde_Inventory_System_RemoteAccess
.\start-backend-remote.ps1
```

```powershell
cd D:\python_project\anegudde\Anegudde_Inventory_System_RemoteAccess
.\start-frontend-remote.ps1
```

The frontend script will print the exact current LAN URL automatically.
Open the app from another device on the same Wi-Fi/LAN:

```text
http://YOUR_PC_IP:2508
```

Example:

```text
http://192.168.0.101:2508
```

The frontend proxies API calls to the backend on port `2509`, so only the frontend URL needs to be opened in the browser.

If another device cannot connect, allow these ports in Windows Firewall:

- `2508` for the frontend
- `2509` for the backend

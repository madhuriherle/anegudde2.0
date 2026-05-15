# Remote Access Copy

This copy uses separate ports so it can run beside the original project.

- Frontend: `http://localhost:5185`
- Backend: `http://localhost:2417`
- Backend docs: `http://localhost:2417/docs`

From this project copy, start the backend:

```powershell
cd C:\anegudde\Anegudde_Inventory_System_RemoteAccess\backend
.\start_remote.ps1
```

Start the frontend in another terminal:

```powershell
cd C:\anegudde\Anegudde_Inventory_System_RemoteAccess\frontend
.\start_remote.ps1
```

For access from another device on the same Wi-Fi/LAN, open:

```text
http://<this-computer-ip>:5185
```

The frontend proxies `/api` requests to the backend on port `2417`.

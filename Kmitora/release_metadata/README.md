# KMITORA v0.3.1 Demo Operations

This release candidate adds a persistent local Demo Supervisor and a
frontend-controlled **Operations → Demo Operations** workspace.

After one bootstrap command, normal demo operations are controlled from the UI:

- Preflight
- Start Demo
- Stop Demo
- Restart Backend
- Restart Frontend
- Restart All
- Refresh Status

The supervisor remains on port `8090` while backend `8080` and frontend `5173`
restart. This is what makes frontend-requested restarts possible.

## One-time bootstrap

```powershell
Set-Location "C:\KMITORA\RELEASES\KMITORA_v0_3_1_demo_ops"
.\scripts\KMITORA_DEMO.ps1 start
```

The browser opens directly to:

`http://127.0.0.1:5173/?page=demoOperations`

After that, use **Operations → Demo Operations** for routine control.

## CLI fallback

```powershell
.\scripts\KMITORA_DEMO.ps1 preflight
.\scripts\KMITORA_DEMO.ps1 start
.\scripts\KMITORA_DEMO.ps1 status
.\scripts\KMITORA_DEMO.ps1 restart
.\scripts\KMITORA_DEMO.ps1 stop
```

`stop` intentionally leaves the supervisor alive so the already-loaded browser
page can start the demo again.

## Ports

- Supervisor: 8090
- Backend: 8080
- Frontend: 5173

## Safety boundary

The UI and supervisor do not grant production authority. KMITORA continues to
require production writes, production cutover, destructive actions and policy
bypass to remain denied in the reference demo.

# Frontend-Only Demo Operations Runbook

## Before a meeting

1. Run the one-time bootstrap if the supervisor is not already running.
2. Open Operations → Demo Operations.
3. Click **Preflight**.
4. Require all checks to pass.
5. Click **Start Demo** if backend/frontend are stopped.
6. Confirm `DEMO STATUS: READY`.
7. Navigate to Cinematic Executive Demo or Mega Demo Control Room.

## During a meeting

Use only the browser controls:

- Restart Backend
- Restart Frontend
- Restart All
- Stop Demo
- Start Demo
- Preflight
- Refresh Status

When the frontend is restarted, the loaded browser page polls port 5173 and
reloads automatically when the frontend returns.

## Important limitation

A browser cannot start its own web server from a completely cold Windows boot.
The persistent supervisor must first exist. `KMITORA_DEMO.ps1 start` performs
that one-time bootstrap and then opens the browser directly to Demo Operations.

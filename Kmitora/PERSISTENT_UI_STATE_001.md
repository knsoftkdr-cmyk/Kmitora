# KMITORA PERSISTENT-UI-STATE-001

Permanent DEV lifecycle-state hardening.

Persists non-secret active source ID, active target ID, saved business requirement, and last good compact Unified Discovery state to `backend/main_api/runtime_state/ui_lifecycle_state.json`.

The frontend rehydrates this state when browser localStorage is empty or lost. Source and target credentials continue to use the existing connection registry/Windows DPAPI flow and are never stored in this UI-state file.

This prevents a Main API/frontend/browser restart from presenting an empty Discover page after a successful run.

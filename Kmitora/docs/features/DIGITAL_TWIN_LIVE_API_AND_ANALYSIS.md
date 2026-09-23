# KMITORA Live A000 Digital Twin Graph

## Endpoints

- `GET /v1/a000/digital-twin/graph?temporal_state=CURRENT`
- `POST /v1/a000/digital-twin/impact`
- `POST /v1/a000/digital-twin/rca`
- `POST /v1/a000/digital-twin/simulate`

The graph is a read-only projection of the current KMITORA reference runtime
state. It does not fabricate execution results and does not authorize production
writes, cutover, destructive changes, or policy bypass.

## UI

Operations → Digital Twin Graph now supports:

- live A000 refresh;
- L0-L9 filters;
- animated downstream blast radius;
- reference RCA path with explicit evidence-validation requirement;
- read-only future-state simulation overlay;
- source vs target comparison;
- evidence/governance inspector;
- Before / Current / Proposed / Simulated / After timeline.

## Run

Start Core/A000 on 8080 and frontend on 5173, then:

```powershell
.\run-digital-twin-live-e2e.ps1
```

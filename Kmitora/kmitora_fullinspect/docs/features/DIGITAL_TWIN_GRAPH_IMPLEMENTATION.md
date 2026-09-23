# KMITORA Advanced Digital Twin Graph

## Added

- Operations → Digital Twin Graph
- L0–L9 layer controls
- interactive SVG graph
- A000 orchestration visualization
- source/system/data/process/runtime/governance/risk/simulation/evidence nodes
- typed relationships
- search/filter
- node inspector
- risk/confidence/evidence metadata
- Before / Current / Proposed / Simulated / After timeline
- persistent A000 scenario context
- explicit default-deny production safety
- Playwright test: `13_digital_twin_graph.spec.ts`

## Run

With Core/A000 on 8080 and frontend on 5173:

```powershell
.\run-digital-twin-graph-e2e.ps1
```

The initial graph data is a deterministic frontend projection designed to plug into
the existing KMITORA digital-twin engine/API. It does not fabricate live runtime
observations or production actions.

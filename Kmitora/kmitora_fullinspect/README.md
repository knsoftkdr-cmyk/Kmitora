# KMITORA

Enterprise data-migration control plane: a React + Vite frontend talking to three
Python (standard-library `http.server`) backend services.

## Folder layout

```
Kmitora-main/
├── README.md                 ← you are here
├── frontend/                 React 18 + TypeScript + Vite UI (port 5173)
│   ├── src/                  pages, components, services, features …
│   ├── tests/e2e/            Playwright end-to-end tests
│   └── vite.config.ts        dev proxy → backend ports
├── backend/
│   ├── main_api/             F1033_server.py        core API      (port 8080)
│   ├── source_api/           kmitora_source_api.py  source API    (port 8081)
│   ├── target_api/           kmitora_target_api.py  target API    (port 8082)
│   ├── agent_runtime/        shared agent runtime modules
│   ├── advanced_intelligence/, autonomy/, dev_e2e/   shared engines
│   ├── tests/                backend unit tests
│   └── requirements.txt
├── supervisor/               optional demo supervisor (port 8090)
├── demo_backend_mega_e2e/    mega backend E2E scenario + runner
├── demo_client_scenarios/    client scenario templates
├── TEST_DATA/                sample source/target data used by tests
├── scripts/                  all PowerShell run / test scripts (run-*.ps1)
├── tools/
│   ├── autonomy_137/         Autonomy-137 patch installer
│   └── legacy_patches/       one-off patch scripts (already applied, kept for reference)
├── docs/                     guides, feature docs, presenter script, notes
├── evidence/                 validation evidence
└── release_metadata/         original release checksums/manifest (pre-cleanup)
```

Note: `TEST_DATA`, `supervisor`, and `demo_backend_mega_e2e` must stay at the
repo root — backend code and tests refer to them by that path.

## Requirements

- Python 3.10+ (tested with 3.12)
- Node.js 18+ and npm

## Run it

### 1. Backend (three terminals)

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate      Linux/Mac:  source .venv/bin/activate
pip install -r requirements.txt
```

```bash
cd backend/main_api   && python F1033_server.py          # http://127.0.0.1:8080
cd backend/source_api && python kmitora_source_api.py    # http://127.0.0.1:8081
cd backend/target_api && python kmitora_target_api.py    # http://127.0.0.1:8082
```

Check: open http://127.0.0.1:8080/health (and 8081, 8082) — each should return 200.

The live Source API supports CSV/TSV, JSON/JSONL, TXT, XML, XLSX and XLSM previews. Excel workbooks are exposed as individual worksheet objects.

### 2. Frontend (fourth terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api`, `/v1`, `/health` → 8080,
`/source-api` → 8081 and `/target-api` → 8082, so no extra config is needed.

Optional env files: copy `backend/.env.example` → `backend/.env` and
`frontend/.env.example` → `frontend/.env.local` to change ports/paths.

### 3. Tests (optional)

```bash
cd frontend
npx playwright install        # first time only
npm run test:e2e:smoke         # backend + frontend must be running
```

Windows PowerShell test scripts are in `scripts/` and auto-detect the repo root:

```powershell
.\scripts\run-e2e.ps1
.\scripts\run-golden-path.ps1
```

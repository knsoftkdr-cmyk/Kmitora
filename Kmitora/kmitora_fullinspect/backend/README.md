# KMITORA Backend (Python, standard library + openpyxl)

Three independent Python HTTP services (no framework — built on `http.server`):

| Service     | Folder        | Entry point            | Default port |
|-------------|---------------|-------------------------|--------------|
| Main API    | `main_api/`   | `F1033_server.py`       | 8080         |
| Source API  | `source_api/` | `kmitora_source_api.py` | 8081         |
| Target API  | `target_api/` | `kmitora_target_api.py` | 8082         |

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run (each in its own terminal)

```bash
cd backend/main_api   && python3 F1033_server.py     # http://127.0.0.1:8080
cd backend/source_api && python3 kmitora_source_api.py  # http://127.0.0.1:8081
cd backend/target_api && python3 kmitora_target_api.py  # http://127.0.0.1:8082
```

Ports are overridable via env vars where the script supports it (see top of each file, e.g. `KMITORA_HOST` / `KMITORA_PORT` in `F1033_server.py`).

## Live file-source formats

The Source API inventories and previews these read-only DEV formats:

- CSV and TSV
- JSON and JSONL
- TXT (delimiter-aware, with line fallback)
- XML (record-oriented preview)
- XLSX and XLSM (one catalog object per worksheet, using `file.xlsx::SheetName`)

File/folder sources contain no credentials, so their DEV connection metadata can be persisted on Windows, Linux, and macOS. Secret-bearing database connections remain fail-closed on non-Windows hosts unless the explicit test-only secret override is enabled; Windows uses DPAPI.

from __future__ import annotations

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import backend.dev_e2e.certification as cert


class FakeState:
    source_id = "SRC-TEST"
    target_id = "TGT-TEST"
    target_tables = {"customers": [], "orders": [], "order_items": []}


class SourceHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _send(self, status, payload):
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            return self._send(200, {"service": "KMITORA Source API", "status": "HEALTHY", "production_writes": 0, "source_preview_mode": "READ_ONLY"})
        if parsed.path == f"/v1/sources/{FakeState.source_id}/objects":
            return self._send(200, [{"schema": "files", "name": f"{e}.csv", "type": "table"} for e in ("customers", "orders", "order_items")])
        if parsed.path == f"/v1/sources/{FakeState.source_id}/preview":
            obj = parse_qs(parsed.query)["object"][0]
            rows = cert._read_csv(cert.SCENARIO_ROOT / "failure_storm" / "source" / obj)
            return self._send(200, {"columns": list(rows[0]), "rows": rows, "totalRows": len(rows)})
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length) or b"{}")
        if self.path == "/v1/sources":
            return self._send(201, {"id": FakeState.source_id, "name": payload.get("name"), "type": "file", "status": "connected", "filePath": payload.get("filePath")})
        return self._send(404, {"error": "not found"})


class TargetHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _send(self, status, payload):
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            return self._send(200, {"service": "KMITORA Target API", "status": "HEALTHY", "target_preview_mode": "READ_ONLY", "production_writes": 0, "cutover": "DISABLED"})
        if parsed.path == "/v1/targets":
            return self._send(200, [{"id": FakeState.target_id, "name": "Fake DEV Target", "type": "postgresql", "status": "connected", "environment": "DEV", "database": "kmitora_e2e", "schema": "public"}])
        prefix = f"/v1/targets/{FakeState.target_id}/preview"
        if parsed.path == prefix:
            entity = parse_qs(parsed.query)["object"][0]
            rows = FakeState.target_tables[entity]
            return self._send(200, {"columns": list(rows[0]) if rows else [], "rows": rows, "totalRows": len(rows)})
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length) or b"{}")
        if self.path == f"/v1/targets/{FakeState.target_id}/replace-load":
            FakeState.target_tables = {key: [dict(row) for row in rows] for key, rows in payload["tables"].items()}
            counts = {key: len(rows) for key, rows in FakeState.target_tables.items()}
            return self._send(200, {
                "ok": True,
                "mode": "DEV_REPLACE_LOAD",
                "schema": payload["schema"],
                "results": [{"table": f"public.{key}", "attempted": value, "inserted": value, "skipped_no_matching_columns": 0} for key, value in counts.items()],
                "counts": counts,
                "total_loaded": sum(counts.values()),
                "production_write": False,
                "cutover": "DISABLED",
            })
        return self._send(404, {"error": "not found"})


def serve(handler):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


class RunnerIntegrationTests(unittest.TestCase):
    def test_runner_source_heal_replace_load_reconcile(self):
        source_server, _ = serve(SourceHandler)
        target_server, _ = serve(TargetHandler)
        old_source, old_target = cert.SOURCE_BASE, cert.TARGET_BASE
        try:
            cert.SOURCE_BASE = f"http://127.0.0.1:{source_server.server_address[1]}"
            cert.TARGET_BASE = f"http://127.0.0.1:{target_server.server_address[1]}"
            FakeState.target_tables = {"customers": [], "orders": [], "order_items": []}
            result = cert.run_dev_certification({"scenario": "failure_storm"})
            self.assertEqual(result["status"], "PASS")
            self.assertEqual(result["target"]["replace_load"]["total_loaded"], 25)
            self.assertTrue(all(item["matched"] for item in result["post_load_reconciliation"]))
            self.assertEqual(result["safety"]["target_production_writes_after"], 0)
            self.assertEqual(result["safety"]["cutover_after"], "DISABLED")
        finally:
            cert.SOURCE_BASE, cert.TARGET_BASE = old_source, old_target
            source_server.shutdown(); source_server.server_close()
            target_server.shutdown(); target_server.server_close()


if __name__ == "__main__":
    unittest.main()

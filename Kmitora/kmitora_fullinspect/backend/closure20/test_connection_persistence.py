from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from backend.closure20.connection_persistence import (
    SecretProtectionError,
    _protect_json,
    _unprotect_json,
)


class ConnectionPersistenceTests(unittest.TestCase):
    def test_non_secret_file_connector_is_portable(self):
        payload = {
            "name": "Golden File Source",
            "type": "file",
            "filePath": "/tmp/kmitora/source",
        }
        with patch("backend.closure20.connection_persistence.os.name", "posix"):
            protected = _protect_json(payload)
            self.assertTrue(protected.startswith("plain:"))
            self.assertEqual(_unprotect_json(protected), payload)

    def test_secret_payload_still_fails_closed_without_dpapi(self):
        payload = {
            "name": "DEV PostgreSQL",
            "type": "postgresql",
            "password": "do-not-persist-in-cleartext",
        }
        with patch("backend.closure20.connection_persistence.os.name", "posix"), patch.dict(os.environ, {}, clear=False):
            os.environ.pop("KMITORA_TEST_ALLOW_EPHEMERAL_SECRET", None)
            with self.assertRaises(SecretProtectionError):
                _protect_json(payload)

    def test_plain_blob_rejects_sensitive_content(self):
        import base64, json
        raw = json.dumps({"password": "secret"}).encode("utf-8")
        blob = "plain:" + base64.b64encode(raw).decode("ascii")
        with self.assertRaises(SecretProtectionError):
            _unprotect_json(blob)


if __name__ == "__main__":
    unittest.main()

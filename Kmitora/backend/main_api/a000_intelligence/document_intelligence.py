from __future__ import annotations
from pathlib import Path
from typing import Any

class DocumentIntelligenceEngine:
    """Safe registry/classifier foundation. Binary parsing is adapter-driven to avoid false extraction claims."""
    TEXT_TYPES = {".txt", ".md", ".json", ".csv", ".yaml", ".yml", ".sql", ".xml"}
    BINARY_TYPES = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}

    def inspect(self, path: str) -> dict[str, Any]:
        file_path = Path(path)
        ext = file_path.suffix.lower()
        result = {"path": str(file_path), "extension": ext, "exists": file_path.exists(), "production_action_executed": False}
        if not file_path.exists():
            return {**result, "status": "NOT_FOUND"}
        if ext in self.TEXT_TYPES:
            text = file_path.read_text(encoding="utf-8", errors="replace")
            return {**result, "status": "TEXT_AVAILABLE", "character_count": len(text), "preview": text[:2000]}
        if ext in self.BINARY_TYPES:
            return {**result, "status": "ADAPTER_REQUIRED", "message": "Binary/multimodal ingestion requires an approved parser/vision adapter."}
        return {**result, "status": "UNKNOWN_TYPE"}

from __future__ import annotations

from typing import Any


DISCOVERY_LAYERS = [
    "BUSINESS",
    "PROCESS",
    "APPLICATION",
    "CODE",
    "DATA",
    "DATABASE",
    "API",
    "INTEGRATION",
    "INFRASTRUCTURE",
    "SERVER",
    "CONTAINER",
    "CLOUD",
    "NETWORK",
    "SECURITY",
    "IAM",
    "HARDWARE",
    "OBSERVABILITY",
    "OPERATIONS",
    "SOURCE",
    "TARGET",
    "DIGITAL_TWIN",
]


LAYER_ALIASES = {
    "API_INTEGRATION": "API",
    "API_GATEWAY": "API",
    "WEB_SERVICE": "API",

    "SERVER_OS": "SERVER",
    "OPERATING_SYSTEM": "SERVER",

    "SECURITY_IAM": "SECURITY",
    "CYBER_SECURITY": "SECURITY",
    "IDENTITY_ACCESS": "IAM",

    "CLOUD_PLATFORM": "CLOUD",
    "CLOUD_INFRASTRUCTURE": "CLOUD",

    "DATABASE_PLATFORM": "DATABASE",
    "DB": "DATABASE",

    "NETWORK_INFRASTRUCTURE": "NETWORK",

    "IT_OPERATIONS": "OPERATIONS",

    "APPLICATION_SYSTEM": "APPLICATION",

    "SOURCE_SYSTEM": "SOURCE",
    "TARGET_SYSTEM": "TARGET",
}


ADAPTER_REQUIRED_LAYERS = {
    "DATABASE",
    "API",
    "INTEGRATION",
    "INFRASTRUCTURE",
    "SERVER",
    "CONTAINER",
    "CLOUD",
    "NETWORK",
    "SECURITY",
    "IAM",
    "HARDWARE",
    "OBSERVABILITY",
    "OPERATIONS",
}


FOUNDATION_LAYERS = {
    "BUSINESS",
    "PROCESS",
    "APPLICATION",
    "CODE",
    "DATA",
    "SOURCE",
    "TARGET",
    "DIGITAL_TWIN",
}


class DeepDiscoveryRegistry:
    def _canonical_layer(
        self,
        layer: str,
    ) -> str:
        normalized = str(layer).strip().upper()

        return LAYER_ALIASES.get(
            normalized,
            normalized,
        )

    def plan(
        self,
        requested_layers: list[str] | None = None,
    ) -> dict[str, Any]:
        layers = requested_layers or DISCOVERY_LAYERS

        planned_layers = []

        for requested in layers:
            requested_name = str(
                requested
            ).strip().upper()

            canonical = self._canonical_layer(
                requested_name
            )

            if canonical in ADAPTER_REQUIRED_LAYERS:
                status = "ADAPTER_REQUIRED"

            elif canonical in FOUNDATION_LAYERS:
                status = "FOUNDATION_AVAILABLE"

            else:
                status = "UNKNOWN_LAYER"

            planned_layers.append(
                {
                    "layer": requested_name,
                    "canonical_layer": canonical,
                    "status": status,
                    "evidence_acquired": False,
                    "discovered": False,
                    "validated": False,
                }
            )

        return {
            "layers": planned_layers,
            "execution_truth": (
                "FOUNDATION_IS_NOT_DISCOVERY_EVIDENCE"
            ),
            "production_action_executed": False,
        }

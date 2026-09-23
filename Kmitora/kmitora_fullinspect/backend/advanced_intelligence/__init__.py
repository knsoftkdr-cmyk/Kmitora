"""KMITORA Advanced Intelligence.

Shared deterministic and governed runtime foundation for advanced
enterprise-transformation capabilities.

Production execution and cutover are denied by default.
"""

from .contracts import (
    AuthorityBoundary,
    EvidenceRecord,
    EvidenceReference,
    RiskPassport,
    ScoreBreakdown,
)
from .feature_registry import FEATURE_REGISTRY
from .orchestrator import AdvancedIntelligenceOrchestrator

__all__ = [
    "AuthorityBoundary",
    "EvidenceRecord",
    "EvidenceReference",
    "RiskPassport",
    "ScoreBreakdown",
    "FEATURE_REGISTRY",
    "AdvancedIntelligenceOrchestrator",
]
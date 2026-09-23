"""Deterministic A000 capability catalog for serials 1..1,000,000."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Iterator


TOTAL_SCENARIOS = 1_000_000
KQA_START = 825_251


@dataclass(frozen=True, slots=True)
class CapabilityLayer:
    start: int
    end: int
    name: str
    count: int


@dataclass(frozen=True, slots=True)
class KQACategory:
    start: int
    end: int
    name: str
    count: int
    purpose: str


@dataclass(frozen=True, slots=True)
class Scenario:
    serial: int
    scenario_id: str
    layer: str
    kqa_id: str | None
    kqa_category: str | None
    enabled: bool
    environment: str
    production_write_allowed: bool
    production_cutover_allowed: bool
    destructive_action_allowed: bool
    policy_bypass_allowed: bool
    mandatory_evidence: bool
    mandatory_rollback_for_critical: bool


LAYERS: tuple[CapabilityLayer, ...] = (
    CapabilityLayer(1, 250, "Original implementation families", 250),
    CapabilityLayer(251, 100250, "Domain-specific specialists", 100000),
    CapabilityLayer(
        100251,
        200250,
        "Self-healing / RCA / predictive error",
        100000,
    ),
    CapabilityLayer(200251, 250250, "Resilience / DR / chaos", 50000),
    CapabilityLayer(
        250251,
        275250,
        "ModelOps / AgentOps / runtime controls",
        25000,
    ),
    CapabilityLayer(
        275251,
        375250,
        "Autonomous algorithms / skills",
        100000,
    ),
    CapabilityLayer(
        375251,
        425250,
        "Advanced AI-agent profiles",
        50000,
    ),
    CapabilityLayer(
        425251,
        525250,
        "Technology / platform specialists",
        100000,
    ),
    CapabilityLayer(
        525251,
        625250,
        "Security / cyber / digital twin / migration / governance",
        100000,
    ),
    CapabilityLayer(
        625251,
        825250,
        "A000 master continuation A",
        200000,
    ),
    CapabilityLayer(
        825251,
        1000000,
        "Next-generation autonomous QA / assurance / certification",
        174750,
    ),
)


KQA_CATEGORIES: tuple[KQACategory, ...] = (
    KQACategory(
        825251,
        850250,
        "Autonomous QA orchestration",
        25000,
        "Adaptive test planning, selection, prioritization, execution, "
        "coverage control and QA workflow orchestration.",
    ),
    KQACategory(
        850251,
        875250,
        "Synthetic test and data generation",
        25000,
        "Governed synthetic scenarios, test fixtures, boundary datasets, "
        "privacy-safe test data and scenario variation.",
    ),
    KQACategory(
        875251,
        900250,
        "Property-based and invariant testing",
        25000,
        "Invariant, contract, state-transition, combinatorial and "
        "property-based verification across broad input spaces.",
    ),
    KQACategory(
        900251,
        925250,
        "Mutation testing",
        25000,
        "Controlled code/configuration mutations that prove whether tests "
        "detect meaningful defects and unsafe behavioral changes.",
    ),
    KQACategory(
        925251,
        950250,
        "Adversarial and red-team testing",
        25000,
        "Prompt attack, policy-bypass, malformed-input, privilege, abuse, "
        "tenant-isolation and hostile-condition verification.",
    ),
    KQACategory(
        950251,
        975250,
        "Self-learning regression intelligence",
        25000,
        "Verified-success promotion, failure quarantine, regression corpus "
        "growth, recurrence detection and retest prioritization.",
    ),
    KQACategory(
        975251,
        990250,
        "Production assurance",
        15000,
        "Readiness, rollback, observability, resilience, SLO/SLA, release "
        "assurance and production eligibility verification.",
    ),
    KQACategory(
        990251,
        1000000,
        "Continuous certification",
        9750,
        "Continuous evidence, control revalidation, certification status, "
        "policy conformance and release recertification.",
    ),
)


def validate_catalog() -> None:
    """Validate exact 1..1,000,000 coverage and final KQA taxonomy."""
    expected = 1
    total = 0
    for layer in LAYERS:
        if layer.start != expected:
            raise ValueError(
                f"Layer gap/overlap before {layer.start}; expected {expected}."
            )
        actual = layer.end - layer.start + 1
        if actual != layer.count:
            raise ValueError(
                f"Layer {layer.name!r} count mismatch: "
                f"declared={layer.count}, actual={actual}."
            )
        total += actual
        expected = layer.end + 1

    if total != TOTAL_SCENARIOS or expected != TOTAL_SCENARIOS + 1:
        raise ValueError("Master catalog must cover exactly 1..1,000,000.")

    expected = KQA_START
    kqa_total = 0
    for category in KQA_CATEGORIES:
        if category.start != expected:
            raise ValueError(
                f"KQA category gap/overlap before {category.start}; "
                f"expected {expected}."
            )
        actual = category.end - category.start + 1
        if actual != category.count:
            raise ValueError(
                f"KQA category {category.name!r} count mismatch."
            )
        kqa_total += actual
        expected = category.end + 1

    if expected != TOTAL_SCENARIOS + 1 or kqa_total != 174750:
        raise ValueError(
            "KQA taxonomy must cover exactly 825251..1000000 (174,750)."
        )


def layer_for_serial(serial: int) -> CapabilityLayer:
    """Return the master capability layer containing a serial."""
    if not 1 <= serial <= TOTAL_SCENARIOS:
        raise ValueError("serial must be between 1 and 1,000,000")

    for layer in LAYERS:
        if layer.start <= serial <= layer.end:
            return layer

    raise RuntimeError(f"No layer found for serial {serial}.")


def kqa_id_for_serial(serial: int) -> str | None:
    """Map final continuation serials to KQA-000001..KQA-174750."""
    if serial < KQA_START:
        return None
    if serial > TOTAL_SCENARIOS:
        raise ValueError("serial must be <= 1,000,000")
    return f"KQA-{serial - KQA_START + 1:06d}"


def kqa_category_for_serial(serial: int) -> KQACategory | None:
    """Return the detailed KQA category for final-continuation serials."""
    if serial < KQA_START:
        return None
    if serial > TOTAL_SCENARIOS:
        raise ValueError("serial must be <= 1,000,000")

    for category in KQA_CATEGORIES:
        if category.start <= serial <= category.end:
            return category

    raise RuntimeError(f"No KQA category found for serial {serial}.")


def build_scenario(serial: int) -> Scenario:
    """Build one safe, governed scenario descriptor."""
    layer = layer_for_serial(serial)
    category = kqa_category_for_serial(serial)

    return Scenario(
        serial=serial,
        scenario_id=f"KMITORA-{serial:07d}",
        layer=layer.name,
        kqa_id=kqa_id_for_serial(serial),
        kqa_category=category.name if category else None,
        enabled=True,
        environment="DEV",
        production_write_allowed=False,
        production_cutover_allowed=False,
        destructive_action_allowed=False,
        policy_bypass_allowed=False,
        mandatory_evidence=True,
        mandatory_rollback_for_critical=True,
    )


def iter_scenarios(
    start: int = 1,
    end: int = TOTAL_SCENARIOS,
) -> Iterator[Scenario]:
    """Yield scenarios lazily so one million descriptors need not be retained."""
    if start < 1 or end > TOTAL_SCENARIOS or start > end:
        raise ValueError("invalid serial range")
    for serial in range(start, end + 1):
        yield build_scenario(serial)


def catalog_summary() -> dict[str, object]:
    """Return the complete A000 master universe summary."""
    validate_catalog()
    return {
        "orchestrator": "A000",
        "total_scenarios": TOTAL_SCENARIOS,
        "master_layers": [asdict(item) for item in LAYERS],
        "kqa_start": KQA_START,
        "kqa_count": 174750,
        "kqa_categories": [asdict(item) for item in KQA_CATEGORIES],
        "safety": {
            "production_write": "DENIED_BY_DEFAULT",
            "production_cutover": "DENIED_BY_DEFAULT",
            "destructive_action": "DENIED_BY_DEFAULT",
            "policy_bypass": "DENIED_BY_DEFAULT",
            "production_eligibility_is_authorization": False,
            "unsupported_critical_actions": 0,
        },
        "quality_targets": {
            "deterministic_critical_controls": "100% PASS REQUIRED",
            "semantic": ">=98%",
            "grounding": ">=98%",
            "retrieval_recall": ">=95%",
            "universal_probabilistic_accuracy_claim": False,
        },
    }

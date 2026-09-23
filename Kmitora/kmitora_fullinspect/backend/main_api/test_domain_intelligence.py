"""Tests for KMITORA universal domain intelligence."""

import unittest

from domain_intelligence import (
    allocate_agents,
    build_client_context,
    catalog_payload,
    infer_domains,
    synthesize_scenarios,
)


class DomainIntelligenceTests(unittest.TestCase):
    def test_catalog_has_all_seeded_industries_and_functions(self) -> None:
        result = catalog_payload()
        self.assertEqual(result["industry_count"], 120)
        self.assertEqual(result["enterprise_function_count"], 50)
        self.assertEqual(result["total_seeded_domains"], 170)
        self.assertTrue(result["extensible"])

    def test_smart_inference_combines_business_and_technical_context(self) -> None:
        result = infer_domains(
            {
                "description": "Bank customer onboarding and payment modernization",
                "systems": ["Oracle", "Salesforce"],
                "issues": ["API errors", "data defects"],
                "technologies": ["SQL", "REST API", "cloud"],
            }
        )
        names = [item["name"] for item in result["industries"]]
        functions = [item["name"] for item in result["functions"]]
        self.assertIn("Banking", names)
        self.assertIn("Data", functions)
        self.assertFalse(result["production_action_executed"])

    def test_client_context_is_stable_and_governed(self) -> None:
        payload = {
            "description": "Healthcare patient platform migration",
            "systems": ["EHR", "API"],
            "issues": ["schema mismatch"],
        }
        left = build_client_context(payload)
        right = build_client_context(payload)
        self.assertEqual(left["context_id"], right["context_id"])
        self.assertEqual(left["customization"]["production_change"], "EXPLICIT_APPROVAL_REQUIRED")

    def test_dynamic_agents_are_default_deny(self) -> None:
        result = allocate_agents(
            {
                "domain_name": "Banking",
                "functions": ["Risk", "Compliance", "Data"],
                "issues": ["API defect"],
            }
        )
        self.assertEqual(result["orchestrator"], "A000")
        self.assertGreaterEqual(result["agent_count"], 10)
        self.assertTrue(
            all(not agent["production_write_allowed"] for agent in result["agents"])
        )

    def test_scenarios_span_complete_lifecycle(self) -> None:
        result = synthesize_scenarios(
            {
                "description": "Retail order migration",
                "systems": ["POS", "ERP"],
                "issues": ["data defect", "API error"],
            }
        )
        stages = {item["stage"] for item in result["scenarios"]}
        self.assertEqual(len(stages), 13)
        self.assertIn("Understand", stages)
        self.assertIn("Learn", stages)
        self.assertTrue(
            all(not item["production_cutover_allowed"] for item in result["scenarios"])
        )


if __name__ == "__main__":
    unittest.main()

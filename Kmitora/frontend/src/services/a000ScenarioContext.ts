import type {
  MasterScenario,
  ScenarioOutcome,
} from "./a000OneMillionApi";

export const A000_SCENARIO_KEY =
  "kmitora.a000.selectedScenario.v1";
export const A000_OUTCOME_KEY =
  "kmitora.a000.selectedOutcome.v1";

export function saveSelectedScenario(
  scenario: MasterScenario,
): void {
  localStorage.setItem(
    A000_SCENARIO_KEY,
    JSON.stringify(scenario),
  );
  window.dispatchEvent(
    new CustomEvent("kmitora:a000-scenario", {
      detail: scenario,
    }),
  );
}

export function saveSelectedOutcome(
  outcome: ScenarioOutcome,
): void {
  localStorage.setItem(
    A000_OUTCOME_KEY,
    JSON.stringify(outcome),
  );
  window.dispatchEvent(
    new CustomEvent("kmitora:a000-outcome", {
      detail: outcome,
    }),
  );
}

export function readSelectedScenario(): MasterScenario | null {
  try {
    const raw = localStorage.getItem(A000_SCENARIO_KEY);
    return raw ? (JSON.parse(raw) as MasterScenario) : null;
  } catch {
    return null;
  }
}

export function readSelectedOutcome(): ScenarioOutcome | null {
  try {
    const raw = localStorage.getItem(A000_OUTCOME_KEY);
    return raw ? (JSON.parse(raw) as ScenarioOutcome) : null;
  } catch {
    return null;
  }
}


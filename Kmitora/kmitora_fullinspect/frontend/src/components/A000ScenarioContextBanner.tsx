import { useEffect, useState } from "react";
import { BrainCircuit, ShieldCheck } from "lucide-react";

import type {
  MasterScenario,
  ScenarioOutcome,
} from "../services/a000OneMillionApi";
import {
  A000_OUTCOME_KEY,
  A000_SCENARIO_KEY,
  readSelectedOutcome,
  readSelectedScenario,
} from "../services/a000ScenarioContext";
import {
  KMITORA_DOMAIN_CONTEXT_KEY,
  readDomainContext,
} from "../services/domainContext";
import type { ClientDomainContext } from "../services/domainIntelligenceApi";

export default function A000ScenarioContextBanner() {
  const [scenario, setScenario] =
    useState<MasterScenario | null>(
      () => readSelectedScenario(),
    );
  const [outcome, setOutcome] =
    useState<ScenarioOutcome | null>(
      () => readSelectedOutcome(),
    );
  const [domainContext, setDomainContext] =
    useState<ClientDomainContext | null>(
      () => readDomainContext(),
    );

  useEffect(() => {
    const refresh = () => {
      setScenario(readSelectedScenario());
      setOutcome(readSelectedOutcome());
      setDomainContext(readDomainContext());
    };

    const storage = (event: StorageEvent) => {
      if (
        event.key === A000_SCENARIO_KEY ||
        event.key === A000_OUTCOME_KEY ||
        event.key === KMITORA_DOMAIN_CONTEXT_KEY
      ) {
        refresh();
      }
    };

    window.addEventListener(
      "kmitora:a000-scenario",
      refresh,
    );
    window.addEventListener(
      "kmitora:a000-outcome",
      refresh,
    );
    window.addEventListener("storage", storage);
    window.addEventListener("kmitora:domain-context", refresh);

    return () => {
      window.removeEventListener(
        "kmitora:a000-scenario",
        refresh,
      );
      window.removeEventListener(
        "kmitora:a000-outcome",
        refresh,
      );
      window.removeEventListener("storage", storage);
      window.removeEventListener("kmitora:domain-context", refresh);
    };
  }, []);

  if (!scenario && !domainContext) {
    return null;
  }

  return (
    <section
      className="a1mContextBanner"
      data-testid="a000-scenario-context"
    >
      <div className="a1mContextIcon">
        <BrainCircuit size={18} />
      </div>
      <div className="a1mContextMain">
        <span>A000 ACTIVE SCENARIO</span>
        <strong>
          {scenario
            ? `${scenario.scenario_id}${scenario.kqa_id ? ` · ${scenario.kqa_id}` : ""}`
            : "A000 DOMAIN CONTEXT"}
        </strong>
        <small>
          {domainContext
            ? `${domainContext.domain} · ${domainContext.functions.slice(0, 4).join(" · ")}`
            : scenario?.kqa_category ?? scenario?.layer}
        </small>
      </div>
      <div className="a1mContextSafety">
        <ShieldCheck size={15} />
        <span>
          {outcome?.status ?? "SELECTED"} · DEV · PROD
          DENIED
        </span>
      </div>
    </section>
  );
}


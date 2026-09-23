# KMITORA Client Live Demo Presenter Script

## Demo objective

Show one governed enterprise transformation flow using the same backend evidence
that has already passed the Mega Enterprise Backend E2E scenario.

## Recommended duration

10–15 minutes.

## Pre-demo checks

- Backend reachable on port 8080.
- Frontend reachable on port 5173.
- `run-mega-backend-e2e.ps1` has passed locally.
- Operations → Mega Demo Control Room is visible.
- Use **Replay Latest Evidence** for a deterministic presentation.
- Use **Run Live Backend Demo** when the client wants to see the backend execute again.

## Presenter flow

### 1. Opening — 45 seconds

Say:

“KMITORA is an Enterprise AI Transformation Control Plane. It combines business
domain understanding, Digital Twin intelligence, specialist-agent orchestration,
governed transformation, autonomous assurance, reconciliation and evidence in
one lifecycle.”

Then point to the safety status:

“Before any intelligence is useful, control matters. In this demonstration,
production writes, cutover, destructive actions and policy bypass remain denied.”

### 2. Client context and Domain Intelligence — 60 seconds

Point to **Domain** and **Dynamic Scenarios**.

Say:

“KMITORA starts by understanding the client rather than assuming one fixed
workflow. Domain Intelligence combines industry, business functions, systems,
processes, technologies and known problems. A000 uses that context to compose
the specialist team and the scenarios required for this environment.”

### 3. A000 orchestration — 60 seconds

Point to **Dynamic Agent Team**.

Say:

“A000 is the master orchestrator. It does not simply call one model. It routes
work to domain, process, data, application, defect, security, migration,
reliability, QA and evidence specialists while preserving governance.”

### 4. Digital Twin — 60 seconds

Point to **Digital Twin**.

Say:

“The Digital Twin represents enterprise relationships rather than isolated
assets. KMITORA can trace dependencies, calculate blast radius, show a reference
causal path and simulate a proposed future state before any governed execution.”

### 5. 13-stage lifecycle — 90 seconds

Point to the lifecycle rail.

Say:

“The same context follows the complete lifecycle:
Understand, Discover, Detect, Diagnose, Predict, Recommend, Simulate, Execute,
Test, Validate, Reconcile, Evidence and Learn. This prevents handoffs from
losing business or technical context.”

### 6. Backend evidence timeline — 2 minutes

Click **Replay Latest Evidence**.

Say:

“This is not a separate animation. The control room is replaying the report
produced by the backend Mega E2E runner. Each line is an API check, status and
timing from the same backend scenario.”

As checks populate, call out:

- platform and A000 self-test;
- domain inference and dynamic agent allocation;
- discovery, process and rule intelligence;
- privacy, observability and RCA;
- Digital Twin impact and simulation;
- governance negative tests;
- 1M capability boundary coverage and KQA samples;
- governed DEV dry-run migration;
- reconciliation and evidence.

### 7. Governance proof — 60 seconds

Say:

“Notice that success is not measured only by positive actions. The scenario also
proves that invalid capability requests, oversized batches and unauthorized
production migration requests are rejected. KMITORA’s control plane must know
what not to do.”

### 8. Capability universe and QA — 60 seconds

Point to **Capability Universe**.

Say:

“The capability catalog gives A000 a large reusable scenario space. The live
demo samples boundaries across the capability ranges and KQA continuation. The
claim we make here is precise: these representative reference-runtime checks
passed. We do not claim universal probabilistic model accuracy.”

### 9. Governed transformation chain — 90 seconds

Point to **Final Assurance**.

Say:

“The migration portion follows a governed sequence:
Discover → Validate → Approval → Execute in DEV dry-run → Reconcile → Evidence.
The execution is simulated against the current reference runtime and performs no
target or production writes.”

### 10. Final proof — 45 seconds

Point to final result and SHA-256.

Say:

“The local Mega Enterprise Backend E2E has passed 121 out of 121 encoded checks.
The report is machine-readable, human-readable and fingerprinted. That gives
engineering, governance and client stakeholders one evidence chain.”

### 11. Close — 45 seconds

Say:

“The value of KMITORA is not one isolated AI feature. It is the controlled
connection between understanding the enterprise, simulating change, orchestrating
specialists, validating outcomes and proving what happened.”

Close with:

“KMITORA: Understand. Simulate. Transform. Prove.”

## Questions to anticipate

### Is this production autonomous?

No. The current reference runtime demonstrates governed automation and explicitly
keeps production writes, cutover, destructive actions and policy bypass denied.
Production deployment would require client-specific adapters, controls,
authorization and evidence.

### Does 121/121 mean AI is 100% accurate?

No. It means the 121 encoded checks in this Mega E2E scenario passed in the
current reference runtime. Probabilistic model accuracy must be measured
separately with client-specific gold sets and acceptance thresholds.

### Must the client replace existing tools?

No. A key positioning is for KMITORA to operate as a control and assurance plane
above existing cloud, ERP, migration, ETL, testing and custom engineering tools.

### Can KMITORA adapt to another industry?

Yes. The current Domain Intelligence seed contains broad industry and enterprise
function coverage and is designed to be extended with client-specific
terminology, processes, controls, systems and scenarios.

## Presenter fallback

If the live backend run is unavailable, select **Replay Latest Evidence**.
State clearly that you are replaying the latest saved backend report rather than
claiming a new live execution.

## Client-safe language

Prefer:
“reference-runtime check passed,”
“governed DEV dry-run,”
“evidence-backed result,”
“reference causal path,”
“production actions denied.”

Avoid:
“perfect AI,”
“100% universal accuracy,”
“fully autonomous production,”
“guaranteed zero defects.”

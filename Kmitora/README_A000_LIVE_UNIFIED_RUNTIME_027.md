# KMITORA A000 Live Unified Runtime 027

Purpose: permanently attach the already-installed 013-026 intelligence backbone to the normal `/v1/a000/messages` execution path without duplicating existing agent, capability, skill, tool, database, evidence or learning logic.

The bridge reuses A000CoreRuntime and projects: intent classification, canonical registry/dedup selection, policy evaluation, DAG planning, simulation, optional database translation, optional RCA/remediation planning, validation, confidence/abstention, evidence, telemetry and verified-learning promotion gating.

Safety: PLAN_ONLY, no skill/tool execution, no source writes, no target writes, no production actions, no cutover. On bridge failure the attachment fails closed to REVIEW/ABSTAIN and preserves the legacy A000 reply.

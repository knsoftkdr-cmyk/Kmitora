# KMITORA A000 Agent Capability Learning 011

Adds an idempotent backend capability-learning/routing subsystem for A000.

Key rule: equivalent tasks/capabilities are fingerprinted and ignored when already present. Only genuinely new capabilities are added.

The subsystem is knowledge/routing only. It does not grant execution authority and keeps production writes disabled.

# KMITORA DEV Golden Test Data

This pack supports the 13-stage lifecycle:

**Understand → Discover → Detect → Diagnose → Predict → Recommend → Simulate → Execute → Test → Validate → Reconcile → Evidence → Learn**

## Default golden source

Use the directory:

`/mnt/data/KmitoraBuild09092026_extracted/Kmitora/TEST_DATA/E2E_GOLDEN/source/happy`

with Source API type `file`.

Expected source row counts:
- customers: 5
- orders: 6
- order_items: 8
- total: 19

## Defect source

Use `/mnt/data/KmitoraBuild09092026_extracted/Kmitora/TEST_DATA/E2E_GOLDEN/source/defects` for negative/error/adversarial cases.

## PostgreSQL DEV target

Run `target/postgresql/01_setup_target.sql` against a dedicated DEV database.
Do not use a production database.

Expected happy-path reconciliation is in `expected/expected_reconciliation.json`.

## Safety

The target API must keep production writes denied. The test pack never requires production cutover.

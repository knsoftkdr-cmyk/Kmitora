# KMITORA Universal Business Logic & Transformation Engine

## Objective

KMITORA now compiles business prompts/rules against the actual discovered source and target schemas into a bounded transformation intermediate representation (IR). The IR is simulated deterministically before any target write. Source remains read-only; production action and cutover remain disabled.

## Transformation capability coverage

The engine registry contains 52 capabilities covering the supplied PowerCenter/CDI, IDMC, IDQ/Cloud DQ and MDM catalogue, including Expression, Aggregator, Filter, Router, Joiner, Sorter, Lookup, Update Strategy, Sequence Generator, Union, Rank, Normalizer, transaction policy, XML/hierarchy processing, data masking, standardization, parsing, matching, exception handling, decision logic, key generation, MDM match/merge/survivorship/golden-record/XREF/trust/validation.

Capabilities are classified as:

- `NATIVE`: deterministic KMITORA executor.
- `POLICY`: represented in the governed plan but enforced as a control boundary.
- `ADAPTER`: requires a configured/approved external runtime or connector (for example Java/custom code, stored procedure, HTTP/SOAP).

Unsupported/external operations never become arbitrary code execution.

## Source understanding

The Source API advertises and understands:

- Files: CSV, TSV, JSON, JSONL, TXT, XML, XLSX, XLSM.
- Databases: PostgreSQL, MySQL, Oracle, SQL Server, Snowflake.
- Metadata: catalog, schema/columns, previews, field profiling, scenario/tenant scope and relationship inference.

All source access remains read-only.

## Target understanding

The Target API understands PostgreSQL, MySQL, Oracle, SQL Server and Snowflake catalog/schema/preview metadata. It now also exposes a separately governed DEV mutation-plan endpoint for bounded INSERT/UPDATE/DELETE and PostgreSQL ADD_COLUMN/RENAME_COLUMN operations. The endpoint requires a non-empty authorization ID and DEV target; production remains blocked.

## Business-rule compilation pipeline

1. Connect/understand source and target.
2. Read business prompt, numbered rules and optional rule document.
3. Compile deterministic rules first.
4. Build an internal source/target-aware compiler prompt.
5. Optional Gemini augmentation may add only validated IR nodes from the fixed capability catalogue.
6. Validate entity names, field names, operation vocabulary and capability execution class.
7. Execute the native IR deterministically in memory.
8. Create audit trail, exceptions, update-strategy decisions and schema-mutation plan.
9. Feed transformed rows into governed staging.
10. Actual target mutation remains separately authorized.

The model never sees individual source records in the transformation compiler. Natural-language interpretation and row execution are separated.

## Deterministic operations implemented

The executor includes row/set controls for filtering, trimming, casing, mapping, defaults, casts, safe expressions, date normalization, currency cleanup, deterministic masking, sequence/key generation, sorting, ranking, aggregation, exact duplicate matching, union, joins, required/min/greater-than/unique/reference validations and update-strategy classification.

The IR vocabulary additionally covers router, lookup, normalization, parsing/labeling/association, XML/hierarchy, MDM match/merge/survivorship/golden-record and adapter/policy capabilities. External/custom operations remain adapter-gated until a runtime is configured.

## New APIs

- `GET /v1/universal-transformations/status`
- `POST /v1/universal-transformations/compile`
- `GET /v1/capabilities` on Source API
- `GET /v1/capabilities` on Target API
- `POST /v1/targets/{target_id}/apply-plan` for explicitly authorized DEV target mutation plans

## UI

Transformation Studio now fetches the universal business-logic plan from A000 by migration ID and shows:

- capability catalogue size,
- compiled nodes,
- native vs adapter/policy operations,
- simulation change count,
- exception count,
- capability / operation / entity / field / execution / rule traceability,
- target schema mutation plan summary,
- internal prompt fingerprint.

This avoids depending on large browser-local record payloads.

## Safety invariants

- Source writes: disabled.
- Compiler arbitrary code execution: disabled.
- Transform execution: deterministic IR only.
- External custom/HTTP/stored-procedure behavior: adapter-gated.
- Target mutation: DEV only, explicit authorization ID, live catalog/column validation, transaction rollback on failure.
- Production writes: disabled.
- Cutover: disabled.

## Validation performed

- Python compile-all: PASS.
- Main API test suite: 93 PASS.
- Source API tests: 6 PASS.
- New universal transformation tests: 3 PASS.
- TypeScript `tsc --noEmit`: PASS.
- Full Vite build could not be completed in the review container because frontend dependency installation timed out; no build success is claimed.

## SCN-MIG-006 sanity check

The universal engine was exercised against the scoped scenario population:

- customers: 53
- orders: 72
- order_items: 170
- total: 295
- referential exceptions for customer->orders and orders->order_items: 0

The engine preserved the no-target-write safety state during simulation.

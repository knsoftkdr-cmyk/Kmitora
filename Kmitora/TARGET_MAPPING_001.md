# KMITORA TARGET_MAPPING_001

Permanent fix for source-entity to target-table resolution during governed DEV replace-load.

- Does not treat source entity names as target table names.
- Extends discovery mapping inference to deterministic semantic suffix matches with field-overlap disambiguation.
- Supports `address_history -> customer_address_history` while preserving `customer_master -> customer_master`.
- Refuses ambiguous mappings instead of guessing.
- Adds a frontend compatibility bridge for already-created discovery results, using the discovered target catalog only when the candidate is unique.
- Production/cutover controls are unchanged.

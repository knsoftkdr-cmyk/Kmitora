# KMITORA LIFECYCLE_CONTEXT_004

Permanent fix for Detect/Diagnose/Predict/Recommend/Simulate failing with `Circular reference detected`.

Root cause: `_compact_lifecycle_context()` returned the live mutable `stage_outputs` dictionary. During stage execution the current `result` was inserted into that same dictionary, creating a Python object cycle:

`result -> context -> stage_outputs -> result`

Persistence/HTTP JSON serialization then failed.

Fix:
- lifecycle context now contains a detached summary snapshot of prior stage outputs;
- current stage result can be persisted without recursive references;
- response stage output history is also a detached summary;
- no change to source/target write guards or production controls.

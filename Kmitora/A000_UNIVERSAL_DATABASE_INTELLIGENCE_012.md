# KMITORA A000 Universal Database Intelligence 012

Purpose: add universal database knowledge and business-rule routing without duplicating common functionality.

Design:
- 224 supplied database / technology entries are database overlays.
- 76 common database functions are canonical capabilities defined once.
- database-specific routing references the common capability IDs instead of copying implementation logic.
- a repository scanner indexes existing KFM/KAG/KCP/KSK/KTL-style IDs and text signatures to support reuse/crosswalk decisions.
- the runtime is KNOWLEDGE_AND_ROUTING_ONLY. It cannot write source, target or production data.

This patch does not replace existing 011 files. It adds only new 012-owned modules and an idempotent router block.

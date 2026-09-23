# KMITORA MEGA_DEMO_AUTHORITATIVE_REPLAY_008A

Permanent installer repair for MEGA_DEMO_AUTHORITATIVE_REPLAY_008.

The 008 installer used the destination `frontend/src/pages/MegaDemoControlRoom.tsx` as both the patch payload source and the live destination. It then moved that file to `MegaDemoControlRoomLegacy.tsx`, making the next Copy-Item source disappear.

008A isolates patch payload under `_KMITORA_PATCH_PAYLOAD_008A`, safely recovers the original Mega Demo from an existing valid legacy component, Git HEAD, or a safe project backup, then installs the authoritative wrapper without self-copy/self-move behavior.

It refuses to fabricate a legacy component. If recovery is impossible it stops before modifying the project.

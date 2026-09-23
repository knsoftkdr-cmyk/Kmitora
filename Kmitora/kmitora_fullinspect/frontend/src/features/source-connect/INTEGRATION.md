# KMITORA Source Connect + Data View R1

This frontend feature is intentionally backend-adapter based.

Required backend APIs:

POST /v1/sources/test
POST /v1/sources
GET  /v1/sources
GET  /v1/sources/{source_id}/objects
GET  /v1/sources/{source_id}/preview?schema=...&object=...&limit=100

Do NOT persist plaintext database passwords in browser localStorage.

Preferred flow:
1. User fills source connection in frontend.
2. Frontend calls test endpoint.
3. Backend validates connection.
4. Backend stores a credential reference securely.
5. Frontend calls create source.
6. KMITORA discovery starts automatically.
7. User selects source.
8. Objects load.
9. User selects table/view.
10. Backend returns bounded preview rows.
11. UI displays data in an enterprise table.

Security:
- Credentials should be submitted only to backend over protected transport.
- Backend should return masked connection metadata.
- Preview should default to 100 rows and be read-only.
- Apply source-side timeout and row limits.
- Never expose production credentials back to the browser.
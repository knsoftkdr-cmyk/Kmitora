from pathlib import Path

path = Path(
    r"C:\KMITORA_UPDATED\Kmitora-main\frontend\src\pages\Migrate.tsx"
)

text = path.read_text(
    encoding="utf-8"
)

old = '''        grouped[table].push(rec.source_record || {});
'''

new = '''        const rowPayload =
          rec.source_record ??
          rec.record ??
          rec.data ??
          rec.row_data ??
          {};

        grouped[table].push(rowPayload);
'''

if old not in text:
    raise SystemExit(
        "FAIL - expected target-write payload line was not found."
    )

text = text.replace(
    old,
    new,
    1,
)

path.write_text(
    text,
    encoding="utf-8",
)

print(
    "PASS - target write now accepts record/source_record payloads."
)

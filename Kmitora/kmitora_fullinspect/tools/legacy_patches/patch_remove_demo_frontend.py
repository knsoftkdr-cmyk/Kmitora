from pathlib import Path

root = Path(r"C:\KMITORA_UPDATED\Kmitora-main\frontend")

sidebar = root / "src" / "components" / "Sidebar.tsx"
app = root / "src" / "App.tsx"

# ============================================================
# SIDEBAR
# ============================================================

text = sidebar.read_text(encoding="utf-8")

sidebar_targets = [
    '  ["cinematicDemo", "Cinematic Executive Demo", Sparkles],\n',
    '  ["demoOperations", "Demo Operations", Settings],\n',
]

for target in sidebar_targets:
    if target not in text:
        raise SystemExit(
            f"FAIL - Sidebar entry not found exactly: {target.strip()}"
        )

for target in sidebar_targets:
    text = text.replace(target, "", 1)

sidebar.write_text(text, encoding="utf-8")

# ============================================================
# APP ROUTES
# ============================================================

text = app.read_text(encoding="utf-8")

route_targets = [
    '      case "cinematicDemo": return <CinematicExecutiveDemo/>;\n',
    '      case "demoOperations": return <DemoOperations/>;\n',
]

for target in route_targets:
    if target not in text:
        raise SystemExit(
            f"FAIL - App route not found exactly: {target.strip()}"
        )

for target in route_targets:
    text = text.replace(target, "", 1)

app.write_text(text, encoding="utf-8")

print("PASS - demo navigation and active routes removed.")

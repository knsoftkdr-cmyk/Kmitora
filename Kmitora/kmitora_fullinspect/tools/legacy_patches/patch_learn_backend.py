from pathlib import Path
import re

path = Path(
    r"C:\KMITORA_UPDATED\Kmitora-main\frontend\src\pages\Learn.tsx"
)

text = path.read_text(encoding="utf-8")

api_import = (
    'import { postVerifiedLearning } '
    'from "../services/learningApi";\n'
)

if api_import not in text:
    marker = 'import { useMemo, useState } from "react";\n'

    if marker not in text:
        raise SystemExit(
            "FAIL: Learn import anchor not found."
        )

    text = text.replace(
        marker,
        marker + api_import,
        1,
    )


text = re.sub(
    r'\nfunction makeLearningId\(\): string \{.*?\n\}\n',
    '\n',
    text,
    count=1,
    flags=re.S,
)


start = text.find(
    "  function promoteVerifiedLearning() {"
)

end = text.find(
    "\n  const complete =",
    start,
)

if start == -1 or end == -1:
    raise SystemExit(
        "FAIL: Learn promotion function anchors "
        "not found."
    )

new_function = r'''  async function promoteVerifiedLearning() {
    if (!evidence || !promotionEligible) {
      setMessage(
        "Promotion blocked. Only fully verified evidence may become learned knowledge.",
      );
      return;
    }

    setMessage(
      "Persisting verified learning through the governed KMITORA Core API...",
    );

    try {
      const next =
        await postVerifiedLearning(
          String(evidence.evidence_id),
        );

      localStorage.setItem(
        LEARNING_KEY,
        JSON.stringify(next),
      );

      setLearning(
        next as VerifiedLearningPackage,
      );

      setMessage(
        next.idempotent_replay
          ? "Verified learning already existed in the durable backend store and was safely restored. No source, target or production write was performed."
          : "Verified learning persisted to the durable backend learning store. No source, target or production write was performed.",
      );
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : String(reason),
      );
    }
  }
'''

text = (
    text[:start]
    + new_function
    + text[end:]
)

path.write_text(
    text,
    encoding="utf-8",
)

print(
    "PASS - Learn page now uses backend "
    "verified learning API."
)

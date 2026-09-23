from pathlib import Path

path = Path(
    r"C:\KMITORA_UPDATED\Kmitora-main\frontend\src\pages\Learn.tsx"
)

text = path.read_text(encoding="utf-8")

old_import = (
    'import { postVerifiedLearning } '
    'from "../services/learningApi";'
)

new_import = (
    'import { '
    'getVerifiedLearningByEvidence, '
    'postVerifiedLearning '
    '} from "../services/learningApi";'
)

if old_import in text:
    text = text.replace(
        old_import,
        new_import,
        1,
    )

text = text.replace(
    'import { useMemo, useState } from "react";',
    'import { useEffect, useMemo, useState } from "react";',
    1,
)

anchor = '''  const [message, setMessage] = useState("");
'''

rehydrate = r'''  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!evidence?.evidence_id) {
      return;
    }

    let cancelled = false;

    async function hydrateDurableLearning() {
      try {
        const durable =
          await getVerifiedLearningByEvidence(
            String(evidence?.evidence_id),
          );

        if (cancelled || !durable) {
          return;
        }

        localStorage.setItem(
          LEARNING_KEY,
          JSON.stringify(durable),
        );

        setLearning(
          durable as VerifiedLearningPackage,
        );
      } catch {
        // Keep the currently available local learning
        // package if durable lookup is unavailable.
      }
    }

    void hydrateDurableLearning();

    return () => {
      cancelled = true;
    };
  }, [evidence?.evidence_id]);
'''

if anchor not in text:
    raise SystemExit(
        "FAIL - message state anchor not found."
    )

text = text.replace(
    anchor,
    rehydrate,
    1,
)

path.write_text(
    text,
    encoding="utf-8",
)

print(
    "PASS - Learn page now rehydrates durable backend learning."
)

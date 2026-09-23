import { useEffect } from "react";

function findLegacySection(
  root: HTMLElement,
  heading: HTMLElement,
  type: "SOURCE" | "TARGET"
): HTMLElement | null {
  const addText = type === "SOURCE" ? "Add Source" : "Add Target";
  const idPattern = type === "SOURCE" ? /SRC-\d{3}/ : /TGT-\d{3}/;

  let node: HTMLElement | null = heading.parentElement;

  while (node && node !== root) {
    const text = node.innerText || "";

    const hasAddAction = text.includes(addText);
    const hasSystemId = idPattern.test(text);
    const containsTopology = text.includes("MIGRATION TOPOLOGY");
    const containsBusiness = text.includes("BUSINESS & ARCHITECTURE CONTEXT");
    const containsConnectedSystems = text.includes("CONNECTED SYSTEMS");

    if (
      hasAddAction &&
      hasSystemId &&
      !containsTopology &&
      !containsBusiness &&
      !containsConnectedSystems
    ) {
      return node;
    }

    node = node.parentElement;
  }

  return null;
}

export default function LegacySystemSectionsSuppressor() {
  useEffect(() => {
    const hideLegacySections = () => {
      const root = document.querySelector<HTMLElement>(".kmConnectPremium");
      if (!root) return;

      const candidates = Array.from(
        root.querySelectorAll<HTMLElement>(
          ".eyebrow,h1,h2,h3,h4,.sectionTitle,.panelHeader span"
        )
      );

      for (const element of candidates) {
        const label = (element.textContent || "").trim().toUpperCase();

        if (label !== "SOURCES" && label !== "TARGETS") continue;

        const type = label === "SOURCES" ? "SOURCE" : "TARGET";
        const section = findLegacySection(root, element, type);

        if (section) {
          section.dataset.kmitoraLegacySystemSection = type;
          section.style.display = "none";
        }
      }
    };

    hideLegacySections();

    const observer = new MutationObserver(hideLegacySections);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}


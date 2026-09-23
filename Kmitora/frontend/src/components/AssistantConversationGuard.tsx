import { useEffect } from "react";
import {
  isNonConversationSystemMessage,
  normalizeAssistantText,
  sanitizeAssistantStorageJson,
} from "../config/assistantConversationPolicy";

const CHAT_KEY = /(assistant|copilot|a000|conversation|chat|message|history)/i;

function findConversationRegion(root: HTMLElement): HTMLElement | null {
  const headings = Array.from(root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,strong,span,div"));
  const heading = headings.find((node) => normalizeAssistantText(node.textContent).toLowerCase() === "conversation");
  if (!heading) return null;

  let current: HTMLElement | null = heading;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const parent = current.parentElement;
    if (!parent) break;
    const text = normalizeAssistantText(parent.textContent).toLowerCase();
    if (text.includes("conversation") && parent.querySelector("input,textarea,button") === null) {
      current = parent;
      continue;
    }
    break;
  }

  const container = current.parentElement ?? current;
  const children = Array.from(container.children).filter((x): x is HTMLElement => x instanceof HTMLElement);
  const index = children.indexOf(current);
  if (index >= 0 && index + 1 < children.length) return children[index + 1];
  return container;
}

function isSafeLeafMessageNode(node: HTMLElement): boolean {
  if (node.matches("input,textarea,button,a,select,option,label")) return false;
  if (node.querySelector("input,textarea,button,a,select")) return false;

  const elementChildren = Array.from(node.children).filter((x) => x instanceof HTMLElement) as HTMLElement[];
  if (elementChildren.length === 0) return true;

  // Permit simple wrappers containing only text-formatting children, but never large message containers.
  return elementChildren.every((child) =>
    child.matches("span,strong,small,em,b,i") && child.querySelector("div,p,article,li,button,input,textarea") === null
  );
}

function clearOldGuardMarks(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-kmitora-assistant-hidden="1"], [data-kmitora-conversation-guard]')
    .forEach((node) => {
      node.style.removeProperty("display");
      node.removeAttribute("data-kmitora-assistant-hidden");
      node.removeAttribute("data-kmitora-conversation-guard");
    });
}

function suppressTelemetryOnly(root: HTMLElement) {
  const region = findConversationRegion(root);
  if (!region) return;

  const candidates = [region, ...Array.from(region.querySelectorAll<HTMLElement>("div,p,article,li,span"))];
  for (const node of candidates) {
    if (node.closest("[data-kmitora-live-chat='1']")) continue;
    if (!isSafeLeafMessageNode(node)) continue;
    const text = normalizeAssistantText(node.textContent);
    if (!text) continue;
    if (isNonConversationSystemMessage(text)) {
      node.dataset.kmitoraAssistantHidden = "1";
      node.style.setProperty("display", "none", "important");
    }
  }
}

function cleanPersistedAssistantConversation() {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && CHAT_KEY.test(key)) keys.push(key);
  }

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const cleaned = sanitizeAssistantStorageJson(raw);
    if (cleaned !== raw) localStorage.setItem(key, cleaned);
  }
}

export default function AssistantConversationGuard() {
  useEffect(() => {
    cleanPersistedAssistantConversation();

    const root = document.querySelector<HTMLElement>("aside.copilot");
    if (!root) return;

    // Undo any broad hiding from the previous ROOT fix before applying the narrow filter.
    clearOldGuardMarks(root);
    suppressTelemetryOnly(root);

    let scheduled = false;
    const run = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        suppressTelemetryOnly(root);
      });
    };

    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    const originalSetItem = Storage.prototype.setItem;
    const guardedSetItem = function(this: Storage, key: string, value: string) {
      if (this === localStorage && CHAT_KEY.test(key)) {
        originalSetItem.call(this, key, sanitizeAssistantStorageJson(value));
        return;
      }
      originalSetItem.call(this, key, value);
    };
    Storage.prototype.setItem = guardedSetItem;

    return () => {
      observer.disconnect();
      if (Storage.prototype.setItem === guardedSetItem) Storage.prototype.setItem = originalSetItem;
    };
  }, []);

  return null;
}
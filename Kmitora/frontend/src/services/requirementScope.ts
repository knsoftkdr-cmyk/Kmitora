export type ScopeOperator = "EQ" | "NEQ";

export type ScopePredicate = {
  field: string;
  operator: ScopeOperator;
  value: string;
  sourceRule: string;
};

export type CompiledSourceScope = {
  mode: "UNSCOPED" | "FILTERED";
  predicates: ScopePredicate[];
  description: string;
};

function stripValue(raw: string) {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.;,]+$/g, "")
    .trim();
}

function addPredicate(out: ScopePredicate[], predicate: ScopePredicate) {
  const key = `${predicate.field.toLowerCase()}|${predicate.operator}|${predicate.value.toLowerCase()}`;
  if (!out.some((item) => `${item.field.toLowerCase()}|${item.operator}|${item.value.toLowerCase()}` === key)) {
    out.push(predicate);
  }
}

/**
 * Compile natural-language business rules into deterministic read-only source
 * scope predicates. This is the UI companion to A000/A200 Intent Migration
 * scope compilation in the backend.
 *
 * Supported examples:
 * - Process only records where scenario_id equals SCN-MIG-006.
 * - Only records where tenant_id = TEN-001.
 * - Exclude every record where scenario_id is not SCN-MIG-006.
 * - Exclude records where status equals CANCELLED.
 */
export function compileSourceScope(rules: string[]): CompiledSourceScope {
  const predicates: ScopePredicate[] = [];

  for (const rawRule of rules || []) {
    const rule = String(rawRule || "").trim();
    if (!rule) continue;

    let match = rule.match(/(?:process|include|use|discover|migrate)?\s*only\s+(?:the\s+)?records?\s+where\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:equals|=|is)\s+(.+?)\.?$/i);
    if (match) {
      addPredicate(predicates, {
        field: match[1],
        operator: "EQ",
        value: stripValue(match[2]),
        sourceRule: rule,
      });
      continue;
    }

    match = rule.match(/process\s+only\s+records?\s+where\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:equals|=|is)\s+(.+?)\.?$/i);
    if (match) {
      addPredicate(predicates, {
        field: match[1],
        operator: "EQ",
        value: stripValue(match[2]),
        sourceRule: rule,
      });
      continue;
    }

    // "Exclude every record where field is not VALUE" is logically the
    // same inclusion scope as "only field = VALUE".
    match = rule.match(/exclude\s+(?:every|all)?\s*records?\s+where\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:is\s+not|!=|does\s+not\s+equal)\s+(.+?)\.?$/i);
    if (match) {
      addPredicate(predicates, {
        field: match[1],
        operator: "EQ",
        value: stripValue(match[2]),
        sourceRule: rule,
      });
      continue;
    }

    match = rule.match(/exclude\s+(?:every|all)?\s*records?\s+where\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:equals|=|is)\s+(.+?)\.?$/i);
    if (match) {
      addPredicate(predicates, {
        field: match[1],
        operator: "NEQ",
        value: stripValue(match[2]),
        sourceRule: rule,
      });
      continue;
    }

    match = rule.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(=|==|!=)\s*(.+?)\.?$/i);
    if (match) {
      addPredicate(predicates, {
        field: match[1],
        operator: match[2] === "!=" ? "NEQ" : "EQ",
        value: stripValue(match[3]),
        sourceRule: rule,
      });
    }
  }

  if (!predicates.length) {
    return { mode: "UNSCOPED", predicates: [], description: "No row-level source scope compiled from business rules." };
  }

  return {
    mode: "FILTERED",
    predicates,
    description: predicates.map((p) => `${p.field} ${p.operator === "EQ" ? "=" : "!="} ${p.value}`).join(" AND "),
  };
}

function findField(row: Record<string, unknown>, field: string) {
  const wanted = field.toLowerCase();
  return Object.keys(row).find((key) => key.toLowerCase() === wanted);
}

export function rowMatchesScope(row: Record<string, unknown>, scope: CompiledSourceScope) {
  if (scope.mode === "UNSCOPED" || !scope.predicates.length) return true;

  return scope.predicates.every((predicate) => {
    const actualKey = findField(row, predicate.field);
    if (!actualKey) return false;
    const actual = String(row[actualKey] ?? "").trim().toLowerCase();
    const expected = predicate.value.trim().toLowerCase();
    return predicate.operator === "EQ" ? actual === expected : actual !== expected;
  });
}

export function applySourceScope(rows: Record<string, unknown>[], scope: CompiledSourceScope) {
  if (scope.mode === "UNSCOPED") return rows;
  return rows.filter((row) => rowMatchesScope(row, scope));
}

export function entitySupportsScope(columns: string[], scope: CompiledSourceScope) {
  if (scope.mode === "UNSCOPED") return true;
  const normalized = new Set(columns.map((column) => column.toLowerCase()));
  return scope.predicates.every((predicate) => normalized.has(predicate.field.toLowerCase()));
}

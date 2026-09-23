import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type DataRow = Record<string, unknown>;

export type EntityDefinition = {
  sourceObject: string;
  targetObject: string;
  primaryKey: string;
};

export const goldenEntities: EntityDefinition[] = [
  {
    sourceObject: "customers.csv",
    targetObject: "customers",
    primaryKey: "customer_id",
  },
  {
    sourceObject: "orders.csv",
    targetObject: "orders",
    primaryKey: "order_id",
  },
  {
    sourceObject: "order_items.csv",
    targetObject: "order_items",
    primaryKey: "item_id",
  },
];

export function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function normalizeRow(row: DataRow): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, normalizeValue(value)]),
  );
}

export function sortRows(
  rows: DataRow[],
  primaryKey: string,
): Array<Record<string, string>> {
  return rows
    .map(normalizeRow)
    .sort((left, right) =>
      (left[primaryKey] ?? "").localeCompare(right[primaryKey] ?? ""),
    );
}

export function canonicalRows(
  rows: DataRow[],
  primaryKey: string,
): string {
  return JSON.stringify(sortRows(rows, primaryKey));
}

export function rowsSha256(
  rows: DataRow[],
  primaryKey: string,
): string {
  return createHash("sha256")
    .update(canonicalRows(rows, primaryKey), "utf8")
    .digest("hex");
}

export function assertUniquePrimaryKeys(
  rows: DataRow[],
  primaryKey: string,
): boolean {
  const keys = rows.map((row) => normalizeValue(row[primaryKey]));
  return (
    keys.every((key) => key.length > 0) &&
    new Set(keys).size === keys.length
  );
}

export function orphanCount(
  childRows: DataRow[],
  childKey: string,
  parentRows: DataRow[],
  parentKey: string,
): number {
  const parentValues = new Set(
    parentRows.map((row) => normalizeValue(row[parentKey])),
  );

  return childRows.filter(
    (row) => !parentValues.has(normalizeValue(row[childKey])),
  ).length;
}

export async function writeGoldenEvidence(
  evidence: Record<string, unknown>,
): Promise<string> {
  const outputDirectory = path.resolve(
    process.cwd(),
    "test-results",
    "golden-path",
  );

  await mkdir(outputDirectory, { recursive: true });

  const outputPath = path.join(
    outputDirectory,
    "real-source-target-reconcile-evidence.json",
  );

  await writeFile(
    outputPath,
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  return outputPath;
}

import type { MigrationSystem } from "../models/MigrationTopology";

const PACK = "C:\\KMITORA\\KMITORA_BANKING_MANUAL_MULTI_FORMAT_TEST_PACK_R1";

function source(
  id: number,
  name: string,
  connector: string,
  path: string,
  pattern: string,
  status: MigrationSystem["status"],
  message: string
): MigrationSystem {
  return {
    id: `SRC-${String(id).padStart(3, "0")}`,
    role: "SOURCE",
    name,
    category: "FILE",
    connector,
    path,
    pattern,
    status,
    message,
    metadataAccessible: status === "VALIDATED",
    authenticationValidated: status === "VALIDATED",
    readPermissionValidated: status === "VALIDATED",
    writePermissionValidated: false,
    targetWriteRequested: false,
    targetWriteExecuted: false,
    productionActionExecuted: false,
  };
}

export const bankingRecoveredSources: MigrationSystem[] = [
  source(1, "Banking Customers", "csv", `${PACK}\\01_tabular`, "customers.csv", "VALIDATED", "Recovered from manual banking test."),
  source(2, "Banking Accounts", "flatfile", `${PACK}\\01_tabular`, "accounts.tsv", "VALIDATED", "Recovered from manual banking test."),
  source(3, "Banking Account Holders", "flatfile", `${PACK}\\01_tabular`, "account_holders.psv", "VALIDATED", "Recovered from manual banking test."),
  source(4, "Banking Transactions", "json", `${PACK}\\02_structured`, "transactions.jsonl", "VALIDATED", "Physical validation and backend preview adapter previously verified."),
  source(5, "Banking Beneficiaries", "json", `${PACK}\\02_structured`, "beneficiaries.yaml", "VALIDATED", "YAML content preview previously verified; connector metadata upgrade remains optional."),
  source(6, "Banking Beneficiary Links", "flatfile", `${PACK}\\01_tabular`, "beneficiary_links.flat", "VALIDATED", "Physical validation and backend preview adapter previously verified."),

  // Historical source numbering became ambiguous during the manual session.
  // Keep these slots visible rather than inventing evidence.
  source(7, "Recovered Source 7 - Review Required", "flatfile", PACK, "", "NOT_CONFIGURED", "Historical configuration was not conclusively captured. Confirm before validation."),

  source(8, "Banking Accounts JSON", "json", `${PACK}\\02_structured`, "accounts.json", "VALIDATED", "Physical validation previously observed; browser preview evidence was not independently captured."),
  source(9, "Banking Loans XML", "xml", `${PACK}\\02_structured`, "loans.xml", "VALIDATED", "Physical validation previously observed; XML preview remains to be reconfirmed."),

  source(10, "Banking Transactions JSON - Review Required", "json", `${PACK}\\02_structured`, "transactions.json", "FAILED", "Historical test referenced a file that does not exist in the pack. Replace this slot with the intended real source."),

  source(11, "Banking Customers NDJSON", "json", `${PACK}\\02_structured`, "customers.ndjson", "CONFIGURED", "Recovered configuration; validation/preview should be reconfirmed."),
  source(12, "Banking Accounts Avro", "avro", `${PACK}\\03_binary_serialization`, "accounts.avro", "VALIDATED", "Physical validation and direct backend preview returned HTTP 200."),
  source(13, "Banking Accounts BSON", "flatfile", `${PACK}\\03_binary_serialization`, "accounts.bson", "VALIDATED", "Physical validation previously observed. BSON dependency installed; preview should be reconfirmed after adapter integration."),
  source(14, "Banking Transactions MessagePack", "flatfile", `${PACK}\\03_binary_serialization`, "transactions.msgpack", "VALIDATED", "Physical validation previously observed. MessagePack dependency installed; preview should be reconfirmed after adapter integration."),
];

export function shouldRecoverBankingSources(current: MigrationSystem[]) {
  if (!Array.isArray(current) || current.length === 0) return true;
  if (current.length !== 1) return false;

  const first = current[0];
  return (
    first.id === "SRC-001" &&
    first.name === "Source 1" &&
    first.pattern === "KMITORA_SOURCE_DATA.xlsx"
  );
}


import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CheckCircle2, Search, X } from "lucide-react";

type DomainCategory =
  | "Financial Services"
  | "Healthcare & Life Sciences"
  | "Retail & Consumer"
  | "Manufacturing & Industrial"
  | "Energy & Utilities"
  | "Custom";

type DomainDefinition = {
  id: string;
  name: string;
  category: DomainCategory;
  functions: string[];
};

export type DomainIntelligenceContext = {
  domain_id: string;
  domain_name: string;
  domain_category: string;
  business_function: string;
  custom_domain?: string;
  domain_intelligence_enabled: boolean;
  migration_id?: string;
  updated_at: string;
};

const DEFAULT_FUNCTIONS = [
  "Customer / Party",
  "Product / Service",
  "Orders / Transactions",
  "Finance / Accounting",
  "Operations",
  "Risk / Compliance",
  "Master Data",
  "Reference Data",
  "Reporting / Analytics",
  "Documents / Content",
];

const DOMAINS: DomainDefinition[] = [
  { id: "D001", name: "Banking", category: "Financial Services", functions: ["Customer / Party", "Accounts", "Deposits", "Loans", "Payments", "Cards", "KYC", "AML", "Treasury", "Risk / Compliance"] },
  { id: "D002", name: "Capital Markets", category: "Financial Services", functions: ["Client / Counterparty", "Trading", "Orders", "Positions", "Securities", "Settlement", "Corporate Actions", "Market Data", "Risk", "Regulatory Reporting"] },
  { id: "D003", name: "Insurance", category: "Financial Services", functions: ["Policyholder", "Policy", "Product", "Quote", "Underwriting", "Claims", "Billing", "Agent / Broker", "Actuarial", "Risk / Compliance"] },
  { id: "D004", name: "Payments", category: "Financial Services", functions: ["Customer", "Merchant", "Payment Instrument", "Authorization", "Clearing", "Settlement", "Disputes", "Fraud", "Fees", "Reconciliation"] },
  { id: "D005", name: "FinTech", category: "Financial Services", functions: DEFAULT_FUNCTIONS },
  { id: "D006", name: "Wealth Management", category: "Financial Services", functions: ["Client", "Portfolio", "Holdings", "Orders", "Advisory", "Goals", "Fees", "Suitability", "Performance", "Compliance"] },
  { id: "D007", name: "Asset Management", category: "Financial Services", functions: ["Investor", "Fund", "Portfolio", "Holdings", "Orders", "NAV", "Performance", "Fees", "Compliance", "Reporting"] },
  { id: "D008", name: "Accounting", category: "Financial Services", functions: ["Chart of Accounts", "General Ledger", "AP", "AR", "Fixed Assets", "Costing", "Close", "Consolidation", "Reporting", "Controls"] },
  { id: "D009", name: "Audit", category: "Financial Services", functions: ["Entity", "Engagement", "Controls", "Evidence", "Sampling", "Findings", "Risk", "Workpapers", "Remediation", "Reporting"] },
  { id: "D010", name: "Tax", category: "Financial Services", functions: ["Taxpayer / Entity", "Transactions", "Tax Rules", "Returns", "Withholding", "Indirect Tax", "Direct Tax", "Transfer Pricing", "Compliance", "Reporting"] },

  { id: "D011", name: "Healthcare", category: "Healthcare & Life Sciences", functions: ["Patient", "Provider", "Encounter", "Diagnosis", "Procedure", "Medication", "Claims", "Billing", "Clinical Documents", "Consent / Privacy"] },
  { id: "D012", name: "Hospitals", category: "Healthcare & Life Sciences", functions: ["Patient", "Admission / Discharge", "Bed / Ward", "Clinical Orders", "Lab", "Radiology", "Pharmacy", "Billing", "Staff", "Assets"] },
  { id: "D013", name: "Pharmaceuticals", category: "Healthcare & Life Sciences", functions: ["Product / Drug", "Formula", "Batch / Lot", "Manufacturing", "Quality", "Supply Chain", "Serialization", "Regulatory", "Safety", "Commercial"] },
  { id: "D014", name: "Biotechnology", category: "Healthcare & Life Sciences", functions: DEFAULT_FUNCTIONS },
  { id: "D015", name: "Medical Devices", category: "Healthcare & Life Sciences", functions: ["Device", "UDI", "Product", "Manufacturing", "Quality", "Service", "Complaint", "Vigilance", "Regulatory", "Distribution"] },
  { id: "D016", name: "Life Sciences", category: "Healthcare & Life Sciences", functions: DEFAULT_FUNCTIONS },
  { id: "D017", name: "Clinical Research", category: "Healthcare & Life Sciences", functions: ["Study", "Site", "Subject", "Visit", "Protocol", "Case Report Form", "Lab", "Adverse Event", "Consent", "Submission"] },
  { id: "D018", name: "Health Insurance", category: "Healthcare & Life Sciences", functions: ["Member", "Plan", "Provider", "Eligibility", "Enrollment", "Claim", "Authorization", "Payment", "Benefit", "Fraud / Compliance"] },
  { id: "D019", name: "Public Health", category: "Healthcare & Life Sciences", functions: ["Citizen / Population", "Program", "Facility", "Case", "Disease", "Surveillance", "Immunization", "Outbreak", "Resource", "Reporting"] },

  { id: "D020", name: "Retail", category: "Retail & Consumer", functions: ["Customer", "Product", "Store", "Order", "POS", "Inventory", "Promotion", "Pricing", "Returns", "Loyalty"] },
  { id: "D021", name: "E-Commerce", category: "Retail & Consumer", functions: ["Customer", "Catalog", "Product", "Cart", "Order", "Payment", "Shipment", "Returns", "Promotion", "Marketplace"] },
  { id: "D022", name: "Consumer Goods", category: "Retail & Consumer", functions: DEFAULT_FUNCTIONS },
  { id: "D023", name: "FMCG", category: "Retail & Consumer", functions: ["Product", "SKU", "Customer", "Distributor", "Order", "Inventory", "Pricing", "Promotion", "Sales", "Supply Chain"] },
  { id: "D024", name: "Wholesale", category: "Retail & Consumer", functions: DEFAULT_FUNCTIONS },
  { id: "D025", name: "Distribution", category: "Retail & Consumer", functions: ["Supplier", "Customer", "Warehouse", "Inventory", "Order", "Allocation", "Shipment", "Route", "Delivery", "Returns"] },
  { id: "D026", name: "Fashion", category: "Retail & Consumer", functions: ["Style", "SKU", "Collection", "Season", "Supplier", "Inventory", "Order", "Store", "Pricing", "Returns"] },
  { id: "D027", name: "Luxury Goods", category: "Retail & Consumer", functions: ["Client", "Product", "Serial / Authenticity", "Boutique", "Order", "Inventory", "Service", "Warranty", "Loyalty", "Compliance"] },

  { id: "D028", name: "Manufacturing", category: "Manufacturing & Industrial", functions: ["Material", "BOM", "Routing", "Work Order", "Production", "Quality", "Plant", "Asset", "Inventory", "Maintenance"] },
  { id: "D029", name: "Automotive", category: "Manufacturing & Industrial", functions: ["Vehicle", "VIN", "Model", "BOM", "Production", "Supplier", "Dealer", "Warranty", "Service", "Parts"] },
  { id: "D030", name: "Aerospace", category: "Manufacturing & Industrial", functions: ["Aircraft / Asset", "Part", "Configuration", "BOM", "Manufacturing", "Maintenance", "Airworthiness", "Supplier", "Quality", "Traceability"] },
  { id: "D031", name: "Defense", category: "Manufacturing & Industrial", functions: ["Program", "Asset", "Configuration", "Supply Chain", "Maintenance", "Mission", "Logistics", "Security", "Compliance", "Traceability"] },
  { id: "D032", name: "Industrial Equipment", category: "Manufacturing & Industrial", functions: ["Equipment", "BOM", "Production", "Customer", "Installation", "Service", "Spare Parts", "Warranty", "Maintenance", "IoT / Telemetry"] },
  { id: "D033", name: "Electronics", category: "Manufacturing & Industrial", functions: ["Product", "Component", "BOM", "Supplier", "Manufacturing", "Test", "Quality", "Inventory", "Serial", "Warranty"] },
  { id: "D034", name: "Semiconductor", category: "Manufacturing & Industrial", functions: ["Wafer", "Lot", "Die", "Product", "Process", "Equipment", "Yield", "Test", "Quality", "Traceability"] },
  { id: "D035", name: "Robotics", category: "Manufacturing & Industrial", functions: ["Robot", "Component", "Firmware", "Configuration", "Telemetry", "Maintenance", "Task", "Safety", "Quality", "Service"] },
  { id: "D036", name: "Chemicals", category: "Manufacturing & Industrial", functions: ["Material", "Formula", "Batch", "Plant", "Production", "Quality", "Safety", "Inventory", "Regulatory", "Distribution"] },

  { id: "D037", name: "Energy", category: "Energy & Utilities", functions: ["Asset", "Site", "Meter", "Generation", "Trading", "Customer", "Contract", "Billing", "Maintenance", "Compliance"] },
  { id: "D038", name: "Oil & Gas", category: "Energy & Utilities", functions: ["Well", "Field", "Asset", "Production", "Pipeline", "Volume", "Trading", "Maintenance", "HSE", "Regulatory"] },
  { id: "D039", name: "Utilities", category: "Energy & Utilities", functions: ["Customer", "Premise", "Meter", "Service Point", "Usage", "Tariff", "Billing", "Outage", "Asset", "Work Order"] },
  { id: "D040", name: "Renewable Energy", category: "Energy & Utilities", functions: ["Site", "Asset", "Generation", "Forecast", "Meter", "Storage", "Grid", "Maintenance", "Contract", "Certificate"] },
  { id: "OTHER", name: "Other / Custom Domain", category: "Custom", functions: DEFAULT_FUNCTIONS },
];

const GROUPS: DomainCategory[] = [
  "Financial Services",
  "Healthcare & Life Sciences",
  "Retail & Consumer",
  "Manufacturing & Industrial",
  "Energy & Utilities",
  "Custom",
];

const STORAGE_KEY = "kmitora.dev.domainIntelligence";

export function getDomainIntelligenceContext(): DomainIntelligenceContext | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DomainIntelligenceContext) : null;
  } catch {
    return null;
  }
}

function persistDomainContext(context: DomainIntelligenceContext | null) {
  if (!context) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  }
  window.dispatchEvent(
    new CustomEvent("kmitora:domain-intelligence-changed", { detail: context }),
  );
}

export default function DomainIntelligencePanel() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [businessFunction, setBusinessFunction] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  useEffect(() => {
    const existing = getDomainIntelligenceContext();
    if (!existing) return;
    setSelectedId(existing.domain_id || "");
    setBusinessFunction(existing.business_function || "");
    setCustomDomain(existing.custom_domain || "");
  }, []);

  const selected = useMemo(
    () => DOMAINS.find((item) => item.id === selectedId) ?? null,
    [selectedId],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return DOMAINS;
    return DOMAINS.filter((item) =>
      `${item.id} ${item.name} ${item.category}`.toLowerCase().includes(query),
    );
  }, [search]);

  const grouped = useMemo(
    () =>
      GROUPS.map((group) => ({
        group,
        items: filtered.filter((item) => item.category === group),
      })).filter((group) => group.items.length > 0),
    [filtered],
  );

  useEffect(() => {
    if (!selected) {
      persistDomainContext(null);
      return;
    }

    const migrationId = localStorage.getItem("kmitora.dev.migrationId") || undefined;
    const effectiveName =
      selected.id === "OTHER" && customDomain.trim()
        ? customDomain.trim()
        : selected.name;

    const context: DomainIntelligenceContext = {
      domain_id: selected.id,
      domain_name: effectiveName,
      domain_category: selected.category,
      business_function: businessFunction,
      custom_domain: selected.id === "OTHER" ? customDomain.trim() : undefined,
      domain_intelligence_enabled: true,
      migration_id: migrationId,
      updated_at: new Date().toISOString(),
    };

    persistDomainContext(context);
  }, [selected, businessFunction, customDomain]);

  const chooseDomain = (id: string) => {
    setSelectedId(id);
    setBusinessFunction("");
    setSearch("");
  };

  const clearDomain = () => {
    setSelectedId("");
    setBusinessFunction("");
    setCustomDomain("");
    setSearch("");
  };

  return (
    <section className="domainIntelligencePanel" aria-label="Domain Intelligence">
      <div className="domainIntelligenceHeader">
        <div className="domainIntelligenceHeading">
          <span className="domainIntelligenceIcon"><BrainCircuit size={19} /></span>
          <div>
            <div className="domainIntelligenceEyebrow">DOMAIN INTELLIGENCE</div>
            <h2>Tell KMITORA what business domain this data belongs to</h2>
            <p>
              Domain context improves discovery interpretation, mappings, business rules,
              transformation recommendations, validation and reconciliation.
            </p>
          </div>
        </div>
        <span className={`domainIntelligenceStatus ${selected ? "is-active" : ""}`}>
          <CheckCircle2 size={13} /> {selected ? "Domain Intelligence Active" : "Select a domain"}
        </span>
      </div>

      <div className="domainIntelligenceGrid">
        <div className="domainIntelligenceSelector">
          <label>Primary Domain</label>
          <div className="domainIntelligenceSearch">
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Banking, Healthcare, Manufacturing..."
            />
          </div>

          <div className="domainIntelligenceResults">
            {grouped.map(({ group, items }) => (
              <div key={group} className="domainIntelligenceGroup">
                <div className="domainIntelligenceGroupTitle">{group}</div>
                <div className="domainIntelligenceOptions">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={selectedId === item.id ? "is-selected" : ""}
                      onClick={() => chooseDomain(item.id)}
                    >
                      <span>{item.name}</span>
                      <small>{item.id}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="domainIntelligenceDetails">
          <div className="domainIntelligenceField">
            <label>Business Function <span>(Optional)</span></label>
            <select
              value={businessFunction}
              disabled={!selected}
              onChange={(event) => setBusinessFunction(event.target.value)}
            >
              <option value="">Select business function...</option>
              {(selected?.functions ?? []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          {selected?.id === "OTHER" ? (
            <div className="domainIntelligenceField">
              <label>Custom Domain</label>
              <input
                value={customDomain}
                onChange={(event) => setCustomDomain(event.target.value)}
                placeholder="Enter your industry or business domain"
              />
            </div>
          ) : null}

          <div className="domainIntelligenceWhy">
            <strong>Why this helps</strong>
            <p>
              KMITORA uses the selected domain as governed context for A000 and the
              Assistant. It does not change source data or authorize migration writes.
            </p>
          </div>
        </div>

        <div className={`domainIntelligenceSummary ${selected ? "is-active" : ""}`}>
          <div className="domainIntelligenceSummaryTitle">Selected Domain</div>
          {selected ? (
            <>
              <div className="domainIntelligenceSummaryMain">
                <span className="domainIntelligenceSummaryIcon"><BrainCircuit size={22} /></span>
                <div>
                  <strong>{selected.id === "OTHER" && customDomain.trim() ? customDomain.trim() : selected.name}</strong>
                  <span>{selected.id} Â· {selected.category}</span>
                </div>
                <CheckCircle2 size={20} className="domainIntelligenceCheck" />
              </div>
              <div className="domainIntelligenceSummaryRow">
                <span>Business Function</span>
                <strong>{businessFunction || "Not selected"}</strong>
              </div>
              <div className="domainIntelligenceSummaryRow">
                <span>Context Scope</span>
                <strong>Current DEV migration</strong>
              </div>
              <button type="button" className="domainIntelligenceClear" onClick={clearDomain}>
                <X size={13} /> Clear
              </button>
            </>
          ) : (
            <div className="domainIntelligenceEmpty">
              Select a primary domain to activate domain-aware migration intelligence.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
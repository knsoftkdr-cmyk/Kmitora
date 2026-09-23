const COMPAT_KEY = "kmitora.dev.discoveryResult";
const VALIDATION_KEY = "kmitora.dev.validationEvidence";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function evidence(
  id: string,
  domain: string,
  status: "PASS" | "FAIL" | "REVIEW",
  message: string,
  rules: string[]
) {
  return {
    id,
    domain,
    status,
    message,
    business_rules: rules,
    mode: "DEV_READ_ONLY",
    target_write: false,
    production_action_executed: false
  };
}

export async function runRealDevValidation(
  currentDiscovery: any
): Promise<any> {
  // Validation projects the governed discovery evidence the backend already
  // produced for THIS migration. It deliberately re-derives nothing: the
  // backend owns rule compilation, quality profiling and relationship
  // inference, so any dataset with any rules document validates without a
  // frontend change.
  const discovery = currentDiscovery ?? readJson<any>(COMPAT_KEY, null);

  if (!discovery) {
    throw new Error(
      "Discovery evidence is unavailable. Run Discover & Understand first."
    );
  }

  const sourceEntities: any[] = Array.isArray(discovery?.source?.entities)
    ? discovery.source.entities
    : [];

  const staging = discovery?.target_staging_plan ?? {};

  const readyRecords: any[] = Array.isArray(staging.ready_records)
    ? staging.ready_records
    : [];

  const reviewRecords: any[] = Array.isArray(staging.review_records)
    ? staging.review_records
    : [];

  const rejectedRecords: any[] = Array.isArray(staging.rejected_records)
    ? staging.rejected_records
    : [];

  const quarantineRecords: any[] = Array.isArray(staging.quarantine_records)
    ? staging.quarantine_records
    : [];

  const referential: any[] = Array.isArray(staging.referential_dependencies)
    ? staging.referential_dependencies.filter((item: any) => item?.entity)
    : [];

  const findings: any[] = Array.isArray(discovery?.quality_findings)
    ? discovery.quality_findings
    : [];

  const relationships: any[] = Array.isArray(discovery?.relationships)
    ? discovery.relationships
    : [];

  const transforms: any[] = Array.isArray(
    discovery?.transform_spec?.transforms
  )
    ? discovery.transform_spec.transforms
    : [];

  const totalRows = sourceEntities.reduce(
    (sum, entity) => sum + Number(entity?.row_count ?? 0),
    0
  );

  if (!totalRows && !readyRecords.length) {
    throw new Error(
      "Discovery evidence contains zero source records. Validation cannot be fabricated."
    );
  }

  const validationEvidence: any[] = [];

  // One data-quality check per source entity, driven by the findings the
  // backend actually raised against that entity.
  for (const entity of sourceEntities) {
    const name = String(entity?.entity ?? entity?.name ?? "").trim();

    if (!name) {
      continue;
    }

    const entityFindings = findings.filter(
      (item) =>
        String(item?.entity ?? "").toLowerCase() === name.toLowerCase()
    );

    const errors = entityFindings.filter(
      (item) => String(item?.severity ?? "").toUpperCase() === "ERROR"
    );

    const types = Array.from(
      new Set(entityFindings.map((item) => String(item?.type ?? "")))
    ).filter(Boolean);

    validationEvidence.push(
      evidence(
        `VAL-QUALITY-${name.toUpperCase()}`,
        name.toUpperCase(),
        errors.length ? "FAIL" : entityFindings.length ? "REVIEW" : "PASS",
        errors.length
          ? `${errors.length} blocking quality finding(s) in ${name}.`
          : entityFindings.length
            ? `${entityFindings.length} quality warning(s) in ${name}.`
            : `No quality findings in ${name} (${entity?.row_count ?? 0} rows).`,
        types
      )
    );
  }

  // One referential check per inferred relationship.
  for (const relation of relationships) {
    const child = String(relation?.child_entity ?? "");
    const parent = String(relation?.parent_entity ?? "");

    const orphans: any[] = Array.isArray(relation?.orphan_values)
      ? relation.orphan_values
      : [];

    validationEvidence.push(
      evidence(
        `VAL-REF-${child.toUpperCase()}-${parent.toUpperCase()}`,
        "REFERENTIAL",
        orphans.length ? "FAIL" : "PASS",
        orphans.length
          ? `${child}.${relation?.child_field} has ${orphans.length} value(s) with no matching ${parent}: ${orphans
              .slice(0, 5)
              .join(", ")}`
          : `Every ${child} row references an existing ${parent}.`,
        relation?.business_rule ? [String(relation.business_rule)] : []
      )
    );
  }

  // One transformation check per compiled transform, so the evidence trail
  // reflects the rules document that was actually supplied.
  for (const transform of transforms) {
    const entity = String(transform?.entity ?? "");
    const field = String(transform?.field ?? "");
    const op = String(transform?.op ?? "");

    const applied = readyRecords.some(
      (record: any) =>
        Array.isArray(record?.applied_transforms) &&
        record.applied_transforms.some(
          (item: any) => String(item?.field ?? "") === field
        )
    );

    validationEvidence.push(
      evidence(
        `VAL-TRANSFORM-${entity.toUpperCase()}-${field.toUpperCase()}`,
        "TRANSFORMATION",
        applied ? "PASS" : "REVIEW",
        applied
          ? `${op} applied to ${entity}.${field}.`
          : `${op} planned for ${entity}.${field} but no staged row required it.`,
        Array.isArray(transform?.business_rules)
          ? transform.business_rules
          : []
      )
    );
  }

  const dispositions = [
    ...readyRecords.map((record: any) => ({
      entity: record?.entity,
      row: record?.row,
      disposition: "READY",
      record: record?.transformed_record ?? record?.source_record ?? {},
      target_write: false,
      execution_state: "NOT_EXECUTED"
    })),
    ...reviewRecords.map((record: any) => ({
      entity: record?.entity,
      row: record?.row,
      disposition: "REVIEW",
      record: record?.source_record ?? {},
      reason: record?.reason,
      target_write: false,
      execution_state: "NOT_EXECUTED"
    })),
    ...rejectedRecords.map((record: any) => ({
      entity: record?.entity,
      row: record?.row,
      disposition: "REJECTED",
      record: record?.source_record ?? {},
      reason: record?.reason,
      target_write: false,
      execution_state: "NOT_EXECUTED"
    }))
  ];

  const blockingFindings = findings.filter(
    (item) => String(item?.severity ?? "").toUpperCase() === "ERROR"
  );

  const status =
    blockingFindings.length || rejectedRecords.length
      ? "REVIEW_REQUIRED"
      : reviewRecords.length
        ? "READY_FOR_REVIEW"
        : "READY";

  const updated = {
    ...discovery,

    status,

    production_action_executed: false,

    quality_findings: findings,

    record_dispositions: dispositions,

    target_staging_plan: {
      ...staging,
      ready_records: readyRecords,
      review_records: reviewRecords,
      quarantine_records: quarantineRecords,
      rejected_records: rejectedRecords,
      referential_dependencies: referential,
      target_write: false,
      production_action_executed: false
    },

    validation_evidence: validationEvidence,

    validation_execution: {
      executed_at: new Date().toISOString(),
      mode: "DEV_READ_ONLY",
      source_api: "READ_ONLY",
      source_record_count: totalRows,
      entities: sourceEntities.map((entity: any) => ({
        entity: entity?.entity ?? entity?.name,
        row_count: entity?.row_count ?? 0
      })),
      quality_findings: findings.length,
      blocking_findings: blockingFindings.length,
      ready_records: readyRecords.length,
      review_records: reviewRecords.length,
      rejected_records: rejectedRecords.length,
      referential_dependencies: referential.length,
      transformation_checks: transforms.length,
      target_write_requested: false,
      target_write_executed: false,
      production_action_executed: false,
      cutover_executed: false
    },

    summary: {
      ...(discovery?.summary ?? {}),
      quality_finding_count: findings.length,
      record_disposition_count: dispositions.length,
      staging_ready_count: readyRecords.length,
      staging_review_count: reviewRecords.length,
      staging_quarantine_count: quarantineRecords.length,
      staging_rejected_count: rejectedRecords.length,
      staging_referential_dependency_count: referential.length
    }
  };

  localStorage.setItem(COMPAT_KEY, JSON.stringify(updated));

  localStorage.setItem(
    VALIDATION_KEY,
    JSON.stringify({
      migration_id: updated?.migration_id ?? null,
      generated_at: new Date().toISOString(),
      status,
      validation_evidence: validationEvidence,
      quality_findings: findings,
      record_dispositions: dispositions,
      target_staging_plan: updated.target_staging_plan,
      safety: {
        source_writes: 0,
        target_writes: 0,
        production_actions: 0,
        cutover_actions: 0
      }
    })
  );

  window.dispatchEvent(
    new CustomEvent("kmitora:validation-evidence", {
      detail: {
        status,
        totalRows,
        findings: findings.length,
        ready: readyRecords.length,
        review: reviewRecords.length,
        rejected: rejectedRecords.length
      }
    })
  );

  return updated;
}

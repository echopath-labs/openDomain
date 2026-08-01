export const AFFECTS_DOMAIN_TYPES = Object.freeze({
  concepts: "domain_concept",
  rules: "business_rule",
  lifecycles: "lifecycle",
  events: "domain_event"
});

export const DOMAIN_OBJECT_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_-]*)+$/;

export const AFFECTS_DOMAIN_FIELDS = Object.freeze(
  Object.keys(AFFECTS_DOMAIN_TYPES)
);

const AFFECTS_DOMAIN_FIELD_SET = new Set(AFFECTS_DOMAIN_FIELDS);

export function validateAffectsDomainShape(value, file) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [issue({
      file,
      field: "affects_domain",
      problem: "Feature spec is missing a valid affects_domain object.",
      fix: "Declare affected OpenDomain concepts, rules, lifecycles, or events."
    })];
  }

  const errors = [];
  for (const field of Object.keys(value)) {
    if (!AFFECTS_DOMAIN_FIELD_SET.has(field)) {
      errors.push(issue({
        file,
        field: `affects_domain.${field}`,
        problem: `Unknown affects_domain field '${field}'.`,
        fix: "Use only concepts, rules, lifecycles, and events."
      }));
    }
  }

  for (const field of AFFECTS_DOMAIN_FIELDS) {
    const ids = value[field];
    if (ids !== undefined && !Array.isArray(ids)) {
      errors.push(issue({
        file,
        field: `affects_domain.${field}`,
        problem: `Feature spec affects_domain.${field} must be an array.`,
        fix: `Use a YAML list of OpenDomain IDs for affects_domain.${field}.`
      }));
      continue;
    }
    for (const [index, id] of (ids ?? []).entries()) {
      if (typeof id !== "string" || !DOMAIN_OBJECT_ID_PATTERN.test(id)) {
        errors.push(issue({
          file,
          field: `affects_domain.${field}[${index}]`,
          problem: "Affected OpenDomain ID must use the canonical dotted format.",
          fix: "Use an ID such as 'sales.order' or remove the invalid list item."
        }));
      }
    }
  }

  return errors;
}

function issue(fields) {
  return {
    code: "invalid_affects_domain",
    severity: "error",
    file: fields.file,
    field: fields.field,
    problem: fields.problem,
    fix: fields.fix
  };
}

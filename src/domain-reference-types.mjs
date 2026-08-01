export const AFFECTS_DOMAIN_TYPES = Object.freeze({
  concepts: "domain_concept",
  rules: "business_rule",
  lifecycles: "lifecycle",
  events: "domain_event"
});

export const AFFECTS_DOMAIN_FIELDS = Object.freeze(
  Object.keys(AFFECTS_DOMAIN_TYPES)
);

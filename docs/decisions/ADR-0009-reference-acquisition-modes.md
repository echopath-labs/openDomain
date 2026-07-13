# ADR-0009: Reference Acquisition Modes

## Status

Accepted

## Context

External tools may already expose structured domain-reference fields, may allow
OpenDomain declarations inside their artifacts, or may need an independent
companion file. Treating all three cases as Domain Declaration obscures schema
ownership and forces unnecessary OpenDomain payloads onto native integrations.

## Decision

Profile Runtime supports three reference acquisition modes:

- Native Mapping adapts fields owned by an external tool's schema.
- Embedded Domain Declaration reads an OpenDomain-owned declaration inside the
  external artifact.
- Sidecar Domain Declaration reads the same OpenDomain-owned declaration from a
  neighboring file.

Each Profile input selects one acquisition mode. Embedded and Sidecar modes are
mutually exclusive and share one declaration schema. Native Mapping does not
use Domain Declaration.

## Consequences

- Tools with useful native fields avoid redundant declaration payloads.
- OpenDomain-owned declarations remain portable across embedded and sidecar
  transports.
- Profile validation can identify schema ownership and ambiguity precisely.

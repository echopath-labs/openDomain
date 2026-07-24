import assert from "node:assert/strict";
import test from "node:test";
import { validateIntegrationValue } from "../src/integration-schema-validator.mjs";

test("Integration Profile schema accepts bounded file and bundle profiles", () => {
  assert.deepEqual(validateIntegrationValue("profile", nativeFileProfile()), []);
  assert.deepEqual(validateIntegrationValue("profile", sidecarBundleProfile()), []);
});

test("Integration Profile schema rejects executable fields and unsupported modes", () => {
  const executable = nativeFileProfile();
  executable.javascript = "return process.env.SECRET";
  const executableIssues = validateIntegrationValue("profile", executable);

  assert.ok(executableIssues.some((issue) => (
    issue.field === "javascript"
    && issue.problem.includes("integration-profile.schema.json")
  )));

  const embedded = sidecarBundleProfile();
  embedded.references.mode = "embedded";
  const embeddedIssues = validateIntegrationValue("profile", embedded);

  assert.ok(embeddedIssues.some((issue) => (
    issue.field === "references.mode"
    && issue.problem.includes("must equal")
  )));
});

test("Domain Declaration schema requires strict non-empty domain scope", () => {
  const valid = {
    schema_version: "1.0",
    affects_domain: {
      concepts: ["sales.order"],
      rules: [],
      lifecycles: [],
      events: []
    }
  };
  assert.deepEqual(validateIntegrationValue("declaration", valid), []);

  const empty = structuredClone(valid);
  empty.affects_domain.concepts = [];
  const emptyIssues = validateIntegrationValue("declaration", empty);
  assert.ok(emptyIssues.length > 0);

  const extra = structuredClone(valid);
  extra.intent = { id: "spec.invalid" };
  const extraIssues = validateIntegrationValue("declaration", extra);
  assert.ok(extraIssues.some((issue) => issue.field === "intent"));
});

test("Grounding Request schema remains compatible with optional Profile metadata", () => {
  const issues = validateIntegrationValue("request", {
    protocol_version: "1.0",
    source: {
      type: "structured-feature",
      path: "features/add-x.yaml"
    },
    intent: {
      id: "feature.add-x",
      name: "Add X",
      status: "proposed"
    },
    affects_domain: {
      concepts: ["sales.order"],
      rules: [],
      lifecycles: [],
      events: []
    },
    integration: {
      id: "structured-feature",
      kind: "profile"
    }
  });

  assert.deepEqual(issues, []);
});

function nativeFileProfile() {
  return {
    schema_version: "1.0",
    id: "structured-feature",
    source_type: "structured-feature",
    source_unit: {
      kind: "file",
      match: {
        paths: ["features/**/*.md"]
      }
    },
    intent: {
      id: {
        from: "primary.id"
      },
      name: {
        first_of: ["primary.name", "primary.title"]
      },
      status: {
        from: "primary.status",
        default: "proposed"
      }
    },
    references: {
      mode: "native",
      affects_domain: {
        concepts: {
          from: "primary.opendomain.concepts",
          coerce: "array"
        }
      }
    }
  };
}

function sidecarBundleProfile() {
  return {
    schema_version: "1.0",
    id: "structured-change",
    source_type: "structured-change",
    source_unit: {
      kind: "bundle",
      match: {
        paths: ["changes/**"],
        root_marker: "change.yaml"
      },
      members: {
        primary: {
          path: "feature.md",
          required: true
        },
        manifest: {
          path: "change.yaml",
          required: true
        },
        declaration: {
          path: "opendomain.yaml",
          required: true
        }
      }
    },
    intent: {
      id: {
        from: "manifest.id"
      },
      name: {
        from: "manifest.name"
      },
      status: {
        from: "manifest.status",
        default: "proposed"
      }
    },
    references: {
      mode: "sidecar"
    }
  };
}

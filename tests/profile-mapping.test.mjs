import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildProfileGroundingRequest } from "../src/profile-mapping.mjs";
import { resolveProfileSourceUnit } from "../src/source-unit.mjs";

test("Native Mapping normalizes fallback, default, coercion, and duplicates", async () => {
  await withProject(async (project) => {
    await write(project, "features/add-x.yaml", `intent:
  id: feature.add-x
  title: Add X
domain:
  concepts: sales.order
  rules:
    - sales.confirmed-order-cannot-be-deleted
    - sales.confirmed-order-cannot-be-deleted
`);
    const entry = nativeEntry("structured-yaml", "features/**/*.yaml");
    const source = await resolveProfileSourceUnit(
      entry,
      "features/add-x.yaml",
      { cwd: project }
    );
    const result = await buildProfileGroundingRequest(
      entry,
      source.sourceUnit,
      { selected: "auto" }
    );

    assert.equal(source.errors.length, 0);
    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.request.intent, {
      id: "feature.add-x",
      name: "Add X",
      status: "proposed"
    });
    assert.deepEqual(result.request.affects_domain, {
      concepts: ["sales.order"],
      rules: ["sales.confirmed-order-cannot-be-deleted"],
      lifecycles: [],
      events: []
    });
    assert.equal(result.request.integration.selected, "auto");
    assert.equal(result.request.integration.source_unit.root_path, "features/add-x.yaml");
    assert.equal(JSON.stringify(result.request).includes(project), false);
  });
});

test("Profile readers support JSON and ignore Markdown body prose", async () => {
  await withProject(async (project) => {
    await write(project, "features/json-feature.json", JSON.stringify({
      intent: {
        id: "feature.json",
        name: "JSON feature",
        status: "proposed"
      },
      domain: {
        concepts: ["sales.order"]
      }
    }));
    await write(project, "features/markdown-feature.md", `---
intent:
  id: feature.markdown
  name: Markdown feature
  status: proposed
domain:
  concepts:
    - sales.order
---

This prose mentions invented.domain-id and must not be parsed.
`);

    for (const [file, id] of [
      ["features/json-feature.json", "feature.json"],
      ["features/markdown-feature.md", "feature.markdown"]
    ]) {
      const entry = nativeEntry(`profile-${path.extname(file).slice(1)}`, `features/*${path.extname(file)}`);
      const source = await resolveProfileSourceUnit(entry, file, { cwd: project });
      const result = await buildProfileGroundingRequest(entry, source.sourceUnit);

      assert.equal(result.errors.length, 0);
      assert.equal(result.request.intent.id, id);
      assert.deepEqual(result.request.affects_domain.concepts, ["sales.order"]);
      assert.equal(result.request.affects_domain.concepts.includes("invented.domain-id"), false);
    }
  });
});

test("Sidecar Mapping uses strict declaration scope and external intent", async () => {
  await withProject(async (project) => {
    await write(project, "changes/add-x/change.yaml", `id: feature.add-x
name: Add X
status: proposed
`);
    await write(project, "changes/add-x/feature.md", `---
kind: feature
---

# Add X
`);
    await write(project, "changes/add-x/opendomain.yaml", `schema_version: "1.0"
affects_domain:
  concepts:
    - sales.order
  rules: []
  lifecycles:
    - sales.order-lifecycle
  events: []
`);
    const entry = sidecarEntry();
    const source = await resolveProfileSourceUnit(
      entry,
      "changes/add-x/feature.md",
      { cwd: project }
    );
    const result = await buildProfileGroundingRequest(entry, source.sourceUnit);

    assert.equal(source.errors.length, 0);
    assert.equal(result.errors.length, 0);
    assert.equal(result.request.source.path, "changes/add-x");
    assert.deepEqual(result.request.affects_domain, {
      concepts: ["sales.order"],
      rules: [],
      lifecycles: ["sales.order-lifecycle"],
      events: []
    });
  });
});

test("Profile Mapping fails closed for missing intent, empty scope, and unsupported members", async () => {
  await withProject(async (project) => {
    await write(project, "features/empty.yaml", `intent:
  id: feature.empty
  name: ""
domain:
  concepts: []
`);
    const entry = nativeEntry("empty-profile", "features/*.yaml");
    const source = await resolveProfileSourceUnit(entry, "features/empty.yaml", { cwd: project });
    const result = await buildProfileGroundingRequest(entry, source.sourceUnit);

    assert.ok(result.errors.some((error) => error.field === "intent.name"));
    assert.ok(result.errors.some((error) => (
      error.field === "references.affects_domain"
      && error.problem.includes("no explicit OpenDomain references")
    )));

    await write(project, "features/unsupported.txt", "structured=false\n");
    const unsupportedEntry = nativeEntry("unsupported-profile", "features/*.txt");
    const unsupportedSource = await resolveProfileSourceUnit(
      unsupportedEntry,
      "features/unsupported.txt",
      { cwd: project }
    );
    const unsupported = await buildProfileGroundingRequest(
      unsupportedEntry,
      unsupportedSource.sourceUnit
    );
    assert.ok(unsupported.errors.some((error) => error.problem.includes("Unsupported structured member extension")));
  });
});

test("Sidecar Mapping rejects declarations with copied intent or empty scope", async () => {
  await withProject(async (project) => {
    await write(project, "changes/invalid/change.yaml", `id: feature.invalid
name: Invalid feature
status: proposed
`);
    await write(project, "changes/invalid/feature.md", "---\nkind: feature\n---\n");
    await write(project, "changes/invalid/opendomain.yaml", `schema_version: "1.0"
intent:
  id: copied.intent
affects_domain:
  concepts: []
  rules: []
  lifecycles: []
  events: []
`);
    const entry = sidecarEntry();
    const source = await resolveProfileSourceUnit(entry, "changes/invalid", { cwd: project });
    const result = await buildProfileGroundingRequest(entry, source.sourceUnit);

    assert.ok(result.errors.some((error) => (
      error.file === "changes/invalid/opendomain.yaml"
      && error.field === "intent"
    )));
    assert.equal(result.request, null);
  });
});

async function withProject(callback) {
  const project = await mkdtemp(path.join(os.tmpdir(), "opendomain-profile-mapping-"));
  try {
    await callback(project);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}

async function write(root, relativePath, content) {
  const file = path.join(root, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

function nativeEntry(id, pattern) {
  return {
    id,
    sourceFile: `opendomain/integrations/profiles/${id}.yaml`,
    profile: {
      schema_version: "1.0",
      id,
      source_type: "structured-feature",
      source_unit: {
        kind: "file",
        match: {
          paths: [pattern]
        }
      },
      intent: {
        id: {
          from: "primary.intent.id"
        },
        name: {
          first_of: ["primary.intent.name", "primary.intent.title"]
        },
        status: {
          from: "primary.intent.status",
          default: "proposed"
        }
      },
      references: {
        mode: "native",
        affects_domain: {
          concepts: {
            from: "primary.domain.concepts",
            coerce: "array"
          },
          rules: {
            from: "primary.domain.rules"
          }
        }
      }
    }
  };
}

function sidecarEntry() {
  return {
    id: "structured-change",
    sourceFile: "opendomain/integrations/profiles/structured-change.yaml",
    profile: {
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
    }
  };
}

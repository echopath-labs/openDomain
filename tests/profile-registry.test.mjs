import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  inspectIntegrations,
  loadIntegrationProfiles
} from "../src/profile-registry.mjs";

test("Profile registry is optional and integration inspection includes OpenSpec", async () => {
  await withProject(async (project) => {
    await mkdir(path.join(project, "opendomain"), { recursive: true });

    const registry = await loadIntegrationProfiles({ cwd: project });
    const inspection = await inspectIntegrations({ cwd: project });

    assert.equal(registry.errors.length, 0);
    assert.equal(registry.profile_file_count, 0);
    assert.deepEqual(registry.profiles, []);
    assert.deepEqual(inspection.integrations, [{
      id: "openspec",
      kind: "builtin",
      source_type: "openspec",
      source_unit_kind: "builtin",
      reference_mode: "native",
      source_file: null
    }]);
  });
});

test("Profile registry loads valid YAML files in deterministic order", async () => {
  await withProject(async (project) => {
    await writeProfile(project, "z.yaml", nativeProfile("z-profile", "features/z/**"));
    await writeProfile(project, "a.yml", nativeProfile("a-profile", "features/a/**"));

    const registry = await loadIntegrationProfiles({ cwd: project });

    assert.equal(registry.errors.length, 0);
    assert.equal(registry.profile_file_count, 2);
    assert.deepEqual(
      registry.profiles.map((entry) => entry.id),
      ["a-profile", "z-profile"]
    );
    assert.deepEqual(
      registry.profiles.map((entry) => entry.sourceFile),
      [
        "opendomain/integrations/profiles/a.yml",
        "opendomain/integrations/profiles/z.yaml"
      ]
    );
  });
});

test("Profile registry rejects duplicate and built-in IDs", async () => {
  await withProject(async (project) => {
    await writeProfile(project, "first.yaml", nativeProfile("duplicate", "features/first/**"));
    await writeProfile(project, "second.yaml", nativeProfile("duplicate", "features/second/**"));
    await writeProfile(project, "openspec.yaml", nativeProfile("openspec", "features/open/**"));

    const registry = await loadIntegrationProfiles({ cwd: project });

    assert.ok(registry.errors.some((error) => error.problem.includes("Duplicate Integration Profile ID 'duplicate'")));
    assert.ok(registry.errors.some((error) => error.problem.includes("conflicts with a built-in integration")));
    assert.deepEqual(registry.profiles, []);
  });
});

test("Profile semantic validation rejects unsafe paths and unavailable member roles", async () => {
  await withProject(async (project) => {
    const profile = nativeProfile("unsafe-profile", "../features/**");
    profile.intent.name = { from: "manifest.name" };
    await writeProfile(project, "unsafe.yaml", profile);

    const registry = await loadIntegrationProfiles({ cwd: project });

    assert.ok(registry.errors.some((error) => (
      error.field === "source_unit.match.paths[0]"
      && error.problem.includes("parent traversal")
    )));
    assert.ok(registry.errors.some((error) => (
      error.field === "intent.name"
      && error.problem.includes("unconfigured")
    )));
  });
});

test("Profile discovery uses legacy fallback but never merges dual roots", async () => {
  await withProject(async (project) => {
    await writeProfile(
      project,
      "legacy.yaml",
      nativeProfile("legacy-profile", "legacy/**"),
      "domain"
    );

    const legacy = await loadIntegrationProfiles({ cwd: project });
    assert.deepEqual(legacy.profiles.map((entry) => entry.id), ["legacy-profile"]);
    assert.ok(legacy.warnings.some((warning) => warning.problem.includes("legacy")));

    await writeProfile(
      project,
      "canonical.yaml",
      nativeProfile("canonical-profile", "canonical/**"),
      "opendomain"
    );
    const dual = await loadIntegrationProfiles({ cwd: project });

    assert.deepEqual(dual.profiles.map((entry) => entry.id), ["canonical-profile"]);
    assert.ok(dual.warnings.some((warning) => warning.problem.includes("ignoring 'domain/'")));
  });
});

test("Profile discovery rejects directories reached through intermediate symlinks", async () => {
  await withProject(async (project) => {
    const externalDirectory = path.join(project, "profile-store");
    await mkdir(path.join(externalDirectory, "profiles"), { recursive: true });
    await writeFile(
      path.join(externalDirectory, "profiles/linked.yaml"),
      toYaml(nativeProfile("linked-profile", "features/**")),
      "utf8"
    );
    await mkdir(path.join(project, "opendomain"), { recursive: true });
    await symlink(
      externalDirectory,
      path.join(project, "opendomain/integrations")
    );

    const registry = await loadIntegrationProfiles({ cwd: project });

    assert.deepEqual(registry.profiles, []);
    assert.ok(registry.errors.some((error) => (
      error.problem.includes("must not resolve through a symbolic link")
    )));
  });
});

test("Profile discovery fails closed when its schema registry is unavailable", async () => {
  await withProject(async (project) => {
    await writeProfile(project, "valid.yaml", nativeProfile("valid-profile", "features/**"));

    const registry = await loadIntegrationProfiles({
      cwd: project,
      schemaRegistry: {
        validate() {
          throw new Error("fixture schema failure");
        }
      }
    });

    assert.deepEqual(registry.profiles, []);
    assert.equal(registry.errors.length, 1);
    assert.equal(registry.errors[0].file, "schemas");
    assert.ok(registry.errors[0].problem.includes("fixture schema failure"));
  });
});

async function withProject(callback) {
  const project = await mkdtemp(path.join(os.tmpdir(), "opendomain-profile-registry-"));
  try {
    await callback(project);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}

async function writeProfile(project, file, profile, workspace = "opendomain") {
  const directory = path.join(project, workspace, "integrations", "profiles");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, file), toYaml(profile), "utf8");
}

function nativeProfile(id, pattern) {
  return {
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
        from: "primary.id"
      },
      name: {
        from: "primary.name"
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
          from: "primary.affects.concepts",
          coerce: "array"
        }
      }
    }
  };
}

function toYaml(profile) {
  return `schema_version: "${profile.schema_version}"
id: ${profile.id}
source_type: ${profile.source_type}
source_unit:
  kind: ${profile.source_unit.kind}
  match:
    paths:
      - ${profile.source_unit.match.paths[0]}
intent:
  id:
    from: ${profile.intent.id.from}
  name:
    from: ${profile.intent.name.from}
  status:
    from: ${profile.intent.status.from}
    default: ${profile.intent.status.default}
references:
  mode: native
  affects_domain:
    concepts:
      from: primary.affects.concepts
      coerce: array
`;
}

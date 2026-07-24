import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { Minimatch } from "minimatch";
import { parseYamlMapping } from "./frontmatter.mjs";
import { validateIntegrationValue } from "./integration-schema-validator.mjs";
import { inspectWorkspaceRoots } from "./workspace-resolver.mjs";

export const PROFILE_DIRECTORY = "integrations/profiles";
export const BUILTIN_INTEGRATION_IDS = Object.freeze(["openspec"]);

const BUILTIN_ID_SET = new Set(BUILTIN_INTEGRATION_IDS);
const PROFILE_EXTENSIONS = new Set([".yaml", ".yml"]);
const MEMBER_ROLES = ["primary", "manifest", "declaration"];
const GLOB_OPTIONS = Object.freeze({
  dot: true,
  nocase: false,
  nocomment: true,
  nonegate: true,
  matchBase: false
});

export async function loadIntegrationProfiles(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const workspace = await inspectWorkspaceRoots({ cwd });
  const result = {
    workspace: workspace.sourceRootDisplay,
    workspace_mode: workspace.mode,
    profile_directory: workspace.sourceRoot
      ? displayPath(workspace.projectRoot, path.join(workspace.sourceRoot, PROFILE_DIRECTORY))
      : null,
    profile_file_count: 0,
    profiles: [],
    warnings: [...workspace.warnings],
    errors: [...workspace.errors]
  };

  if (result.errors.length > 0) {
    return result;
  }
  if (!workspace.sourceRoot) {
    if (options.allowMissingWorkspace === true) {
      return result;
    }
    result.errors.push(issue({
      file: "<workspace>",
      problem: "No OpenDomain workspace found for Integration Profiles.",
      fix: "Run 'opendomain init' to create 'opendomain/', or use --integration openspec for the built-in adapter."
    }));
    return result;
  }

  const profileDirectory = path.join(workspace.sourceRoot, PROFILE_DIRECTORY);
  let directoryStat;
  try {
    directoryStat = await lstat(profileDirectory);
  } catch (error) {
    if (error.code === "ENOENT") {
      return result;
    }
    result.errors.push(issue({
      file: result.profile_directory,
      problem: `Unable to inspect the Integration Profile directory: ${error.message}`,
      fix: "Check the workspace path and permissions."
    }));
    return result;
  }

  if (directoryStat.isSymbolicLink()) {
    result.errors.push(issue({
      file: result.profile_directory,
      problem: "Integration Profile directory must not be a symbolic link.",
      fix: `Replace '${result.profile_directory}' with a real directory inside the selected workspace.`
    }));
    return result;
  }
  if (!directoryStat.isDirectory()) {
    result.errors.push(issue({
      file: result.profile_directory,
      problem: "Integration Profile slot is not a directory.",
      fix: `Replace '${result.profile_directory}' with a directory.`
    }));
    return result;
  }

  let resolvedProfileDirectory;
  try {
    resolvedProfileDirectory = await realpath(profileDirectory);
  } catch (error) {
    result.errors.push(issue({
      file: result.profile_directory,
      problem: `Integration Profile directory cannot be resolved: ${error.message}`,
      fix: "Replace symlinked or unreadable path segments with real directories inside the selected workspace."
    }));
    return result;
  }
  if (
    resolvedProfileDirectory !== path.resolve(profileDirectory)
    || !isWithin(workspace.sourceRoot, resolvedProfileDirectory)
  ) {
    result.errors.push(issue({
      file: result.profile_directory,
      problem: "Integration Profile directory must not resolve through a symbolic link or outside the selected workspace.",
      fix: "Store Profiles in a real integrations/profiles directory inside the selected OpenDomain workspace."
    }));
    return result;
  }

  const entries = (await readdir(profileDirectory, { withFileTypes: true }))
    .sort((left, right) => compareText(left.name, right.name));

  for (const entry of entries) {
    const extension = path.extname(entry.name).toLowerCase();
    if (!PROFILE_EXTENSIONS.has(extension)) {
      continue;
    }

    result.profile_file_count += 1;
    const absoluteFile = path.join(profileDirectory, entry.name);
    const sourceFile = displayPath(workspace.projectRoot, absoluteFile);

    if (entry.isSymbolicLink()) {
      result.errors.push(issue({
        file: sourceFile,
        problem: "Integration Profile files must not be symbolic links.",
        fix: "Store the Profile as a regular YAML file inside the selected workspace."
      }));
      continue;
    }
    if (!entry.isFile()) {
      result.errors.push(issue({
        file: sourceFile,
        problem: "Integration Profile path is not a regular YAML file.",
        fix: "Replace it with a regular .yaml or .yml file."
      }));
      continue;
    }

    let profile;
    try {
      profile = parseYamlMapping(await readFile(absoluteFile, "utf8"), sourceFile, {
        label: "Integration Profile"
      });
    } catch (error) {
      result.errors.push(issue({
        file: sourceFile,
        field: error.field ?? "$",
        problem: error.problem ?? error.message,
        fix: "Use one safe YAML mapping that satisfies the Integration Profile v1 schema."
      }));
      continue;
    }

    let schemaIssues;
    try {
      schemaIssues = validateIntegrationValue(
        "profile",
        profile,
        options.schemaRegistry
      );
    } catch (error) {
      result.profiles = [];
      result.errors.push(issue({
        file: "schemas",
        problem: `Integration schema registry is unavailable: ${error.message}`,
        fix: "Restore or reinstall the packaged integration schemas before loading Profiles."
      }));
      result.errors.sort(compareIssues);
      return result;
    }
    if (schemaIssues.length > 0) {
      result.errors.push(...schemaIssues.map((schemaIssue) => ({
        ...schemaIssue,
        file: sourceFile
      })));
      continue;
    }

    const semanticIssues = validateProfileSemantics(profile, sourceFile);
    if (semanticIssues.length > 0) {
      result.errors.push(...semanticIssues);
      continue;
    }

    result.profiles.push(Object.freeze({
      id: profile.id,
      sourceFile,
      absoluteFile,
      profile
    }));
  }

  validateRegistryIds(result);
  result.profiles.sort((left, right) => (
    compareText(left.sourceFile, right.sourceFile)
    || compareText(left.id, right.id)
  ));
  result.errors.sort(compareIssues);

  return result;
}

export async function inspectIntegrations(options = {}) {
  const registry = await loadIntegrationProfiles(options);
  return {
    workspace: registry.workspace,
    workspace_mode: registry.workspace_mode,
    profile_directory: registry.profile_directory,
    profile_file_count: registry.profile_file_count,
    valid_profile_count: registry.profiles.length,
    integrations: [
      builtinOpenSpecSummary(),
      ...registry.profiles.map(profileSummary)
    ],
    warnings: registry.warnings,
    errors: registry.errors
  };
}

export function profileMatchesPath(profile, workspaceRelativePath) {
  return profile.source_unit.match.paths.some((pattern) => (
    new Minimatch(pattern, GLOB_OPTIONS).match(workspaceRelativePath)
  ));
}

function validateProfileSemantics(profile, sourceFile) {
  const errors = [];
  const sourceUnit = profile.source_unit;

  sourceUnit.match.paths.forEach((pattern, index) => {
    const field = `source_unit.match.paths[${index}]`;
    const problem = unsafeGlobProblem(pattern);
    if (problem) {
      errors.push(issue({
        file: sourceFile,
        field,
        problem,
        fix: "Use a normalized, workspace-relative glob without parent traversal or backslashes."
      }));
      return;
    }

    try {
      const matcher = new Minimatch(pattern, GLOB_OPTIONS);
      if (!matcher.makeRe()) {
        throw new Error("glob could not be compiled");
      }
    } catch (error) {
      errors.push(issue({
        file: sourceFile,
        field,
        problem: `Invalid Profile glob '${pattern}': ${error.message}`,
        fix: "Use a valid deterministic glob over workspace-relative paths."
      }));
    }
  });

  if (sourceUnit.kind === "bundle") {
    validateRelativeConfigPath(
      sourceUnit.match.root_marker,
      sourceFile,
      "source_unit.match.root_marker",
      errors
    );

    const memberPaths = new Map();
    for (const role of MEMBER_ROLES) {
      const member = sourceUnit.members[role];
      if (!member) {
        continue;
      }
      validateRelativeConfigPath(
        member.path,
        sourceFile,
        `source_unit.members.${role}.path`,
        errors
      );
      const existingRole = memberPaths.get(member.path);
      if (existingRole) {
        errors.push(issue({
          file: sourceFile,
          field: `source_unit.members.${role}.path`,
          problem: `Source Unit roles '${existingRole}' and '${role}' use the same member path '${member.path}'.`,
          fix: "Assign one distinct exact path to each configured member role."
        }));
      } else {
        memberPaths.set(member.path, role);
      }
    }
  }

  const configuredRoles = new Set(
    sourceUnit.kind === "file"
      ? ["primary"]
      : MEMBER_ROLES.filter((role) => sourceUnit.members[role])
  );
  for (const [field, selector] of collectSelectors(profile)) {
    const paths = selector.from ? [selector.from] : selector.first_of;
    for (const selectorPath of paths) {
      const role = selectorPath.split(".", 1)[0];
      if (!configuredRoles.has(role)) {
        errors.push(issue({
          file: sourceFile,
          field,
          problem: `Selector '${selectorPath}' references unconfigured Source Unit role '${role}'.`,
          fix: `Configure the '${role}' member or select a field from an available member.`
        }));
      }
    }
  }

  if (profile.references.mode === "sidecar") {
    const declaration = sourceUnit.kind === "bundle"
      ? sourceUnit.members.declaration
      : null;
    if (!declaration || declaration.required !== true) {
      errors.push(issue({
        file: sourceFile,
        field: "references.mode",
        problem: "Sidecar mode requires a bundle Source Unit with one required declaration member.",
        fix: "Configure source_unit.kind as bundle and add members.declaration with required: true."
      }));
    }
  }

  if (
    profile.references.mode === "native"
    && sourceUnit.kind === "bundle"
    && sourceUnit.members.declaration
  ) {
    errors.push(issue({
      file: sourceFile,
      field: "source_unit.members.declaration",
      problem: "Native Mapping must not configure a Domain Declaration member.",
      fix: "Remove the declaration member or select references.mode: sidecar."
    }));
  }

  return errors.sort(compareIssues);
}

function validateRegistryIds(result) {
  const byId = new Map();
  for (const entry of result.profiles) {
    if (BUILTIN_ID_SET.has(entry.id)) {
      result.errors.push(issue({
        file: entry.sourceFile,
        field: "id",
        problem: `Profile ID '${entry.id}' conflicts with a built-in integration.`,
        fix: "Choose a repository-local Profile ID that does not use a built-in ID."
      }));
      continue;
    }

    const existing = byId.get(entry.id);
    if (existing) {
      result.errors.push(issue({
        file: entry.sourceFile,
        field: "id",
        problem: `Duplicate Integration Profile ID '${entry.id}' also declared in '${existing.sourceFile}'.`,
        fix: "Give every repository-local Profile a unique ID."
      }));
      continue;
    }
    byId.set(entry.id, entry);
  }

  if (result.errors.length > 0) {
    const invalidIds = new Set(
      result.errors
        .filter((error) => error.field === "id")
        .flatMap((error) => (
          result.profiles
            .filter((entry) => error.file === entry.sourceFile || error.problem.includes(`'${entry.id}'`))
            .map((entry) => entry.id)
        ))
    );
    result.profiles = result.profiles.filter((entry) => !invalidIds.has(entry.id));
  }
}

function collectSelectors(profile) {
  const selectors = [
    ["intent.id", profile.intent.id],
    ["intent.name", profile.intent.name],
    ["intent.status", profile.intent.status]
  ];
  if (profile.references.mode === "native") {
    for (const field of ["concepts", "rules", "lifecycles", "events"]) {
      const selector = profile.references.affects_domain[field];
      if (selector) {
        selectors.push([`references.affects_domain.${field}`, selector]);
      }
    }
  }
  return selectors;
}

function unsafeGlobProblem(pattern) {
  if (pattern.includes("\0")) {
    return "Profile glob contains a null byte.";
  }
  if (pattern.includes("\\")) {
    return "Profile glob uses backslashes instead of normalized '/' separators.";
  }
  if (path.posix.isAbsolute(pattern) || path.win32.isAbsolute(pattern)) {
    return "Profile glob must be workspace-relative, not absolute.";
  }
  if (pattern.split("/").includes("..")) {
    return "Profile glob must not contain parent traversal ('..').";
  }
  return null;
}

function validateRelativeConfigPath(value, sourceFile, field, errors) {
  const segments = value.split("/");
  if (
    value.includes("\0")
    || value.includes("\\")
    || path.posix.isAbsolute(value)
    || path.win32.isAbsolute(value)
    || segments.includes("..")
    || segments.includes(".")
    || segments.includes("")
  ) {
    errors.push(issue({
      file: sourceFile,
      field,
      problem: `Configured path '${value}' is not a normalized relative path.`,
      fix: "Use an exact '/'-separated path inside the Source Unit without '.', '..', or absolute prefixes."
    }));
  }
}

function builtinOpenSpecSummary() {
  return {
    id: "openspec",
    kind: "builtin",
    source_type: "openspec",
    source_unit_kind: "builtin",
    reference_mode: "native",
    source_file: null
  };
}

function profileSummary(entry) {
  return {
    id: entry.id,
    kind: "profile",
    source_type: entry.profile.source_type,
    source_unit_kind: entry.profile.source_unit.kind,
    reference_mode: entry.profile.references.mode,
    source_file: entry.sourceFile
  };
}

function displayPath(projectRoot, file) {
  const relative = path.relative(projectRoot, file);
  if (
    relative === ".."
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)
  ) {
    return file;
  }
  return (relative || ".").split(path.sep).join("/");
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === ""
    || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function issue(fields) {
  return {
    severity: fields.severity ?? "error",
    file: fields.file,
    field: fields.field ?? "$",
    problem: fields.problem,
    fix: fields.fix
  };
}

function compareIssues(left, right) {
  return compareText(left.file, right.file)
    || compareText(left.field, right.field)
    || compareText(left.problem, right.problem);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

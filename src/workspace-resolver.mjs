import { lstat, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { loadGovernanceManifest } from "./governance.mjs";

export const CANONICAL_WORKSPACE_DIRECTORY = "opendomain";
export const LEGACY_WORKSPACE_DIRECTORY = "domain";
export const CANONICAL_DEFAULT_INDEX_PATH = "opendomain/generated/index.json";
export const LEGACY_DEFAULT_INDEX_PATH = ".opendomain/index.json";

export const SEMANTIC_SOURCE_DIRECTORIES = Object.freeze([
  "contexts",
  "concepts",
  "rules",
  "lifecycles",
  "events",
  "candidates"
]);

const SKIPPED_DIRECTORY_NAMES = new Set([".git", "node_modules", ".codex"]);

export async function inspectWorkspaceRoots(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const projectRoot = await realpath(cwd);
  const canonical = await inspectImplicitRoot(
    path.join(cwd, CANONICAL_WORKSPACE_DIRECTORY),
    projectRoot,
    CANONICAL_WORKSPACE_DIRECTORY
  );
  const legacy = await inspectImplicitRoot(
    path.join(cwd, LEGACY_WORKSPACE_DIRECTORY),
    projectRoot,
    LEGACY_WORKSPACE_DIRECTORY
  );
  const warnings = [];
  const errors = [];

  if (canonical.exists && legacy.exists) {
    warnings.push(issue({
      severity: "warning",
      file: CANONICAL_WORKSPACE_DIRECTORY,
      problem: "Both canonical 'opendomain/' and legacy 'domain/' workspaces exist; using 'opendomain/' and ignoring 'domain/'.",
      fix: "Keep canonical sources in 'opendomain/' and remove the legacy root only after confirming it is no longer needed."
    }));
  }

  const selected = canonical.exists ? canonical : legacy.exists ? legacy : null;
  if (selected?.error) {
    errors.push(selected.error);
  }

  if (selected === legacy) {
    warnings.push(issue({
      severity: "warning",
      file: LEGACY_WORKSPACE_DIRECTORY,
      problem: "Using legacy OpenDomain workspace 'domain/' during the 0.x compatibility period.",
      fix: "Plan a non-destructive move to canonical 'opendomain/'; OpenDomain will continue reading 'domain/' throughout 0.x."
    }));
  }

  return {
    projectRoot,
    mode: selected === canonical
      ? "canonical"
      : selected === legacy
        ? "legacy"
        : null,
    sourceRoot: selected?.realPath ?? null,
    sourceRootDisplay: selected?.displayPath ?? null,
    defaultIndexPath: selected === canonical
      ? CANONICAL_DEFAULT_INDEX_PATH
      : LEGACY_DEFAULT_INDEX_PATH,
    canonicalExists: canonical.exists,
    legacyExists: legacy.exists,
    warnings,
    errors
  };
}

export async function resolveWorkspaceSources(targetPath, options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  if (targetPath !== undefined && targetPath !== null && targetPath !== "") {
    return resolveExplicitSources(targetPath, cwd);
  }

  const workspace = await inspectWorkspaceRoots({ cwd });
  const result = {
    ...workspace,
    files: [],
    governance: null,
    sourceOwnership: new Map(),
    explicit: false
  };

  if (result.errors.length > 0) {
    return result;
  }

  if (!workspace.sourceRoot) {
    result.errors.push(issue({
      file: "<workspace>",
      problem: "No OpenDomain workspace found.",
      fix: "Run 'opendomain init' to create 'opendomain/', or pass an explicit Markdown file or directory."
    }));
    return result;
  }

  try {
    if (workspace.mode === "canonical") {
      const governance = await loadGovernanceManifest(workspace.sourceRoot, {
        displayPath: workspace.sourceRootDisplay
      });
      result.errors.push(...governance.errors);
      result.warnings.push(...governance.warnings);
      if (governance.present) {
        result.governance = governance.valid ? governance : null;
        if (!governance.valid) {
          return result;
        }
        const governed = await collectGovernedMarkdown(
          workspace.sourceRoot,
          workspace.sourceRootDisplay,
          governance,
          result.errors
        );
        result.files = governed.files;
        result.sourceOwnership = governed.sourceOwnership;
      } else {
        result.files = await collectImplicitMarkdown(
          workspace.sourceRoot,
          workspace.sourceRootDisplay,
          result.errors
        );
      }
    } else {
      result.files = await collectImplicitMarkdown(
        workspace.sourceRoot,
        workspace.sourceRootDisplay,
        result.errors
      );
    }
  } catch (error) {
    result.errors.push(issue({
      file: workspace.sourceRootDisplay,
      problem: `Unable to read the selected OpenDomain workspace: ${error.message}`,
      fix: "Check workspace permissions and directory structure."
    }));
    return result;
  }

  if (result.files.length === 0 && result.errors.length === 0) {
    result.errors.push(issue({
      file: workspace.sourceRootDisplay,
      problem: "Selected OpenDomain workspace contains no eligible Markdown sources.",
      fix: "Add a non-README Markdown source under contexts, concepts, rules, lifecycles, events, or candidates."
    }));
  }

  return result;
}

export async function resolveDefaultIndexPath(options = {}) {
  const workspace = await inspectWorkspaceRoots(options);
  if (!workspace.sourceRoot && workspace.errors.length === 0) {
    workspace.errors.push(issue({
      file: "<workspace>",
      problem: "No OpenDomain workspace found for the default index path.",
      fix: "Run 'opendomain init', or pass --index <file> explicitly."
    }));
  }
  return workspace;
}

async function resolveExplicitSources(targetPath, cwd) {
  const absoluteTarget = path.resolve(cwd, targetPath);
  const result = {
    projectRoot: await realpath(cwd),
    mode: "explicit",
    sourceRoot: null,
    sourceRootDisplay: displayPath(cwd, absoluteTarget),
    defaultIndexPath: LEGACY_DEFAULT_INDEX_PATH,
    canonicalExists: false,
    legacyExists: false,
    warnings: [],
    errors: [],
    files: [],
    governance: null,
    sourceOwnership: new Map(),
    explicit: true
  };

  let targetInfo;
  try {
    const targetRealPath = await realpath(absoluteTarget);
    targetInfo = {
      realPath: targetRealPath,
      stat: await stat(targetRealPath)
    };
  } catch (error) {
    result.errors.push(issue({
      file: String(targetPath),
      problem: error.code === "ENOENT"
        ? "Path does not exist."
        : `Unable to resolve path: ${error.message}`,
      fix: "Pass an existing OpenDomain Markdown file or directory."
    }));
    return result;
  }

  result.sourceRoot = targetInfo.realPath;
  result.sourceRootDisplay = displayPath(cwd, targetInfo.realPath);

  if (targetInfo.stat.isFile()) {
    if (!isMarkdownFile(targetInfo.realPath)) {
      result.errors.push(issue({
        file: String(targetPath),
        problem: "Explicit file target is not a Markdown file.",
        fix: "Pass a file ending in .md or an existing directory."
      }));
      return result;
    }
    result.files = [targetInfo.realPath];
    return result;
  }

  if (!targetInfo.stat.isDirectory()) {
    result.errors.push(issue({
      file: String(targetPath),
      problem: "Explicit target is neither a regular Markdown file nor a directory.",
      fix: "Pass an existing Markdown file or directory."
    }));
    return result;
  }

  try {
    result.files = await walkMarkdown(targetInfo.realPath);
  } catch (error) {
    result.errors.push(issue({
      file: String(targetPath),
      problem: `Unable to read explicit source directory: ${error.message}`,
      fix: "Check target permissions and directory structure."
    }));
    return result;
  }

  if (result.files.length === 0) {
    result.errors.push(issue({
      file: String(targetPath),
      problem: "Explicit directory contains no eligible Markdown sources.",
      fix: "Pass a directory containing at least one non-README .md file."
    }));
  }

  return result;
}

async function inspectImplicitRoot(rootPath, projectRoot, displayName) {
  let rootStat;
  try {
    rootStat = await lstat(rootPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        exists: false,
        realPath: null,
        displayPath: displayName,
        error: null
      };
    }
    return {
      exists: true,
      realPath: null,
      displayPath: displayName,
      error: issue({
        file: displayName,
        problem: `Unable to inspect workspace root: ${error.message}`,
        fix: "Check workspace path permissions."
      })
    };
  }

  let rootRealPath;
  let resolvedStat = rootStat;
  try {
    rootRealPath = await realpath(rootPath);
    if (rootStat.isSymbolicLink()) {
      resolvedStat = await stat(rootRealPath);
    }
  } catch (error) {
    return {
      exists: true,
      realPath: null,
      displayPath: displayName,
      error: issue({
        file: displayName,
        problem: `Workspace root cannot be resolved: ${error.message}`,
        fix: "Replace the broken workspace path with a readable directory."
      })
    };
  }

  if (!resolvedStat.isDirectory()) {
    return {
      exists: true,
      realPath: rootRealPath,
      displayPath: displayName,
      error: issue({
        file: displayName,
        problem: "OpenDomain workspace root is not a directory.",
        fix: `Replace '${displayName}' with a directory or pass an explicit Markdown target.`
      })
    };
  }

  if (!isWithin(projectRoot, rootRealPath)) {
    return {
      exists: true,
      realPath: rootRealPath,
      displayPath: displayName,
      error: issue({
        file: displayName,
        problem: "OpenDomain workspace root resolves outside the project root.",
        fix: "Use a workspace directory contained by the project, or pass the external path explicitly."
      })
    };
  }

  return {
    exists: true,
    realPath: rootRealPath,
    displayPath: displayName,
    error: null
  };
}

async function collectImplicitMarkdown(workspaceRoot, workspaceDisplay, errors) {
  const files = [];
  for (const directoryName of SEMANTIC_SOURCE_DIRECTORIES) {
    const sourcePath = path.join(workspaceRoot, directoryName);
    let sourceStat;
    try {
      sourceStat = await lstat(sourcePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    if (sourceStat.isSymbolicLink()) {
      continue;
    }
    if (!sourceStat.isDirectory()) {
      errors.push(issue({
        file: `${workspaceDisplay}/${directoryName}`,
        problem: `Semantic source slot '${directoryName}/' is not a directory.`,
        fix: `Replace '${directoryName}' with a directory or remove it from the workspace.`
      }));
      continue;
    }
    files.push(...await walkMarkdown(sourcePath));
  }
  return sortPaths(files);
}

async function collectGovernedMarkdown(workspaceRoot, workspaceDisplay, governance, errors) {
  const workspaceRealPath = await realpath(workspaceRoot);
  const resolvedGroups = [];
  const sourceOwnership = new Map();

  for (const group of governance.domainGroups) {
    const sourcePath = path.resolve(workspaceRoot, group.source_root);
    const display = `${workspaceDisplay}/${group.source_root}`;
    const segmentError = await validateGovernedSourceRoot(
      workspaceRoot,
      workspaceRealPath,
      group,
      sourcePath,
      display
    );
    if (segmentError) {
      errors.push(segmentError);
      continue;
    }
    resolvedGroups.push({ group, sourcePath, display });
  }

  for (let leftIndex = 0; leftIndex < resolvedGroups.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < resolvedGroups.length; rightIndex += 1) {
      const left = resolvedGroups[leftIndex];
      const right = resolvedGroups[rightIndex];
      if (isWithin(left.sourcePath, right.sourcePath) || isWithin(right.sourcePath, left.sourcePath)) {
        errors.push(issue({
          file: governance.file,
          field: "domain_groups[].source_root",
          problem: `Governed source roots '${left.group.source_root}' and '${right.group.source_root}' overlap.`,
          fix: "Use disjoint source roots so every semantic document belongs to exactly one domain group."
        }));
      }
    }
  }

  if (errors.length > 0) {
    return { files: [], sourceOwnership };
  }

  const files = [];
  for (const entry of resolvedGroups) {
    const groupErrorsBefore = errors.length;
    const groupFiles = await collectImplicitMarkdown(entry.sourcePath, entry.display, errors);
    if (groupFiles.length === 0 && errors.length === groupErrorsBefore) {
      errors.push(issue({
        file: entry.display,
        field: "source_root",
        problem: `Domain group '${entry.group.id}' contains no eligible Markdown sources.`,
        fix: "Add a semantic source under contexts, concepts, rules, lifecycles, events, or candidates."
      }));
      continue;
    }
    for (const file of groupFiles) {
      files.push(file);
      sourceOwnership.set(file, Object.freeze({
        product_id: entry.group.product,
        domain_group_id: entry.group.id,
        owners: Object.freeze([...entry.group.owners]),
        exposure: entry.group.exposure,
        governance_schema_version: governance.manifest.schema_version,
        source_root: entry.group.source_root
      }));
    }
  }

  const unassigned = await collectUnassignedSemanticMarkdown(
    workspaceRoot,
    resolvedGroups.map((entry) => entry.sourcePath)
  );
  for (const file of unassigned) {
    errors.push(issue({
      file: displayPath(path.dirname(workspaceRoot), file),
      field: "source_root",
      problem: "Governed semantic source is outside every declared domain-group source root.",
      fix: "Move the source under one declared group root or add a disjoint domain-group declaration."
    }));
  }

  return {
    files: sortGovernedFiles(files, sourceOwnership, workspaceRoot),
    sourceOwnership
  };
}

async function validateGovernedSourceRoot(workspaceRoot, workspaceRealPath, group, sourcePath, display) {
  const segments = group.source_root.split("/");
  let current = workspaceRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    let currentStat;
    try {
      currentStat = await lstat(current);
    } catch (error) {
      return issue({
        file: display,
        field: "source_root",
        problem: error.code === "ENOENT"
          ? `Domain group '${group.id}' source root does not exist.`
          : `Unable to inspect domain group '${group.id}' source root: ${error.message}`,
        fix: "Create the declared source root as a real directory inside opendomain/."
      });
    }
    if (currentStat.isSymbolicLink()) {
      return issue({
        file: display,
        field: "source_root",
        problem: `Domain group '${group.id}' source root traverses a symbolic link.`,
        fix: "Use a real directory path contained by opendomain/."
      });
    }
  }

  const sourceRealPath = await realpath(sourcePath);
  const sourceStat = await stat(sourceRealPath);
  if (!sourceStat.isDirectory()) {
    return issue({
      file: display,
      field: "source_root",
      problem: `Domain group '${group.id}' source root is not a directory.`,
      fix: "Replace the declared source root with a directory."
    });
  }
  if (!isWithin(workspaceRealPath, sourceRealPath)) {
    return issue({
      file: display,
      field: "source_root",
      problem: `Domain group '${group.id}' source root resolves outside the canonical workspace.`,
      fix: "Use a workspace-relative directory contained by opendomain/."
    });
  }
  return null;
}

async function collectUnassignedSemanticMarkdown(workspaceRoot, assignedRoots) {
  const files = [];
  await visit(workspaceRoot);
  return sortPaths(files);

  async function visit(directory) {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink() || !entry.isDirectory()) {
        continue;
      }
      if ([...SKIPPED_DIRECTORY_NAMES, "generated", "integrations"].includes(entry.name)) {
        continue;
      }
      const child = path.join(directory, entry.name);
      if (assignedRoots.some((root) => isWithin(root, child))) {
        continue;
      }
      if (SEMANTIC_SOURCE_DIRECTORIES.includes(entry.name)) {
        files.push(...await walkMarkdown(child));
        continue;
      }
      await visit(child);
    }
  }
}

function sortGovernedFiles(files, sourceOwnership, workspaceRoot) {
  return files.sort((left, right) => {
    const leftOwner = sourceOwnership.get(left);
    const rightOwner = sourceOwnership.get(right);
    return compareText(leftOwner.domain_group_id, rightOwner.domain_group_id)
      || compareText(path.relative(workspaceRoot, left), path.relative(workspaceRoot, right));
  });
}

async function walkMarkdown(root) {
  const entries = (await readdir(root, { withFileTypes: true }))
    .sort((left, right) => compareText(left.name, right.name));
  const files = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
        files.push(...await walkMarkdown(path.join(root, entry.name)));
      }
      continue;
    }
    if (
      entry.isFile()
      && isMarkdownFile(entry.name)
      && entry.name.toLowerCase() !== "readme.md"
    ) {
      files.push(path.join(root, entry.name));
    }
  }

  return sortPaths(files);
}

function sortPaths(files) {
  return files.sort(compareText);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isMarkdownFile(file) {
  return file.toLowerCase().endsWith(".md");
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === ""
    || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function displayPath(cwd, file) {
  const relative = path.relative(cwd, file);
  if (relative === "") {
    return ".";
  }
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return file;
  }
  return relative.split(path.sep).join("/");
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

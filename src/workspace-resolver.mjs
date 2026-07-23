import { lstat, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

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
    result.files = await collectImplicitMarkdown(
      workspace.sourceRoot,
      workspace.sourceRootDisplay,
      result.errors
    );
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
    field: "$",
    problem: fields.problem,
    fix: fields.fix
  };
}

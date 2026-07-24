import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { profileMatchesPath } from "./profile-registry.mjs";

const MEMBER_ROLES = ["primary", "manifest", "declaration"];

export async function findMatchingProfileSourceUnits(profiles, inputPath, options = {}) {
  const inputResult = await inspectProfileInput(inputPath, options);
  if (inputResult.errors.length > 0) {
    return {
      input: null,
      matches: [],
      errors: inputResult.errors
    };
  }
  if (!inputResult.input) {
    return {
      input: null,
      matches: [],
      errors: []
    };
  }

  const matches = [];
  for (const entry of profiles) {
    const resolution = await resolveWithInput(entry, inputResult.input);
    if (resolution.matched) {
      matches.push({
        entry,
        sourceUnit: resolution.sourceUnit,
        errors: resolution.errors
      });
    }
  }

  return {
    input: inputResult.input,
    matches,
    errors: []
  };
}

export async function resolveProfileSourceUnit(entry, inputPath, options = {}) {
  const inputResult = await inspectProfileInput(inputPath, options);
  if (inputResult.errors.length > 0) {
    return {
      matched: false,
      sourceUnit: null,
      errors: inputResult.errors
    };
  }
  return resolveWithInput(entry, inputResult.input);
}

async function inspectProfileInput(inputPath, options) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  let projectRoot;
  try {
    projectRoot = await realpath(cwd);
  } catch (error) {
    return {
      input: null,
      errors: [issue({
        file: cwd,
        problem: `Project workspace cannot be resolved: ${error.message}`,
        fix: "Run the command from a readable project directory."
      })]
    };
  }

  if (!inputPath) {
    return {
      input: null,
      errors: [issue({
        file: "<input>",
        problem: "Missing Profile input path.",
        fix: "Run opendomain prepare --profile <id> <structured-file-or-bundle>."
      })]
    };
  }

  const absoluteInput = path.resolve(cwd, inputPath);
  let inputRealPath;
  let inputStat;
  try {
    inputRealPath = await realpath(absoluteInput);
    inputStat = await stat(inputRealPath);
  } catch (error) {
    return {
      input: null,
      errors: [issue({
        file: String(inputPath),
        problem: error.code === "ENOENT"
          ? "Profile input path does not exist."
          : `Profile input path cannot be resolved: ${error.message}`,
        fix: "Pass an existing structured file, bundle root, or bundle member."
      })]
    };
  }

  if (!isWithin(projectRoot, inputRealPath)) {
    if (options.outsideWorkspaceIsNoMatch === true) {
      return {
        input: null,
        errors: []
      };
    }
    return {
      input: null,
      errors: [issue({
        file: String(inputPath),
        problem: "Profile input resolves outside the project workspace.",
        fix: "Use a structured input contained by the current project."
      })]
    };
  }
  if (!inputStat.isFile() && !inputStat.isDirectory()) {
    return {
      input: null,
      errors: [issue({
        file: displayPath(projectRoot, inputRealPath),
        problem: "Profile input is neither a regular file nor a directory.",
        fix: "Pass a regular structured file, bundle root, or bundle member."
      })]
    };
  }

  return {
    input: {
      projectRoot,
      realPath: inputRealPath,
      displayPath: displayPath(projectRoot, inputRealPath),
      stat: inputStat
    },
    errors: []
  };
}

async function resolveWithInput(entry, input) {
  return entry.profile.source_unit.kind === "file"
    ? resolveFileUnit(entry, input)
    : resolveBundleUnit(entry, input);
}

function resolveFileUnit(entry, input) {
  if (!input.stat.isFile() || !profileMatchesPath(entry.profile, input.displayPath)) {
    return {
      matched: false,
      sourceUnit: null,
      errors: []
    };
  }

  return {
    matched: true,
    sourceUnit: {
      schema_version: "1.0",
      kind: "file",
      input_path: input.displayPath,
      root_path: input.displayPath,
      source_type: entry.profile.source_type,
      profile_id: entry.id,
      members: [{
        role: "primary",
        path: input.displayPath,
        absolutePath: input.realPath
      }]
    },
    errors: []
  };
}

async function resolveBundleUnit(entry, input) {
  const profile = entry.profile;
  const markerResult = await findNearestBundleRoot(
    input,
    profile.source_unit.match.root_marker
  );
  if (!markerResult.found) {
    return {
      matched: false,
      sourceUnit: null,
      errors: []
    };
  }

  const rootPath = displayPath(input.projectRoot, markerResult.root);
  if (!profileMatchesPath(profile, rootPath)) {
    return {
      matched: false,
      sourceUnit: null,
      errors: []
    };
  }

  const errors = [...markerResult.errors];
  const members = [];
  const resolvedMemberPaths = new Map();

  for (const role of MEMBER_ROLES) {
    const configured = profile.source_unit.members[role];
    if (!configured) {
      continue;
    }

    const memberResult = await resolveMember({
      role,
      configured,
      root: markerResult.root,
      projectRoot: input.projectRoot
    });
    errors.push(...memberResult.errors);
    if (!memberResult.member) {
      continue;
    }

    const existingRole = resolvedMemberPaths.get(memberResult.member.absolutePath);
    if (existingRole) {
      errors.push(issue({
        file: entry.sourceFile,
        field: `source_unit.members.${role}.path`,
        problem: `Source Unit members '${existingRole}' and '${role}' resolve to the same file.`,
        fix: "Use distinct member files after symlink resolution."
      }));
      continue;
    }

    resolvedMemberPaths.set(memberResult.member.absolutePath, role);
    members.push(memberResult.member);
  }

  return {
    matched: true,
    sourceUnit: {
      schema_version: "1.0",
      kind: "bundle",
      input_path: input.displayPath,
      root_path: rootPath,
      source_type: profile.source_type,
      profile_id: entry.id,
      members
    },
    errors: errors.sort(compareIssues)
  };
}

async function findNearestBundleRoot(input, markerPath) {
  let current = input.stat.isDirectory()
    ? input.realPath
    : path.dirname(input.realPath);

  while (isWithin(input.projectRoot, current)) {
    const marker = path.join(current, ...markerPath.split("/"));
    let markerStat;
    try {
      markerStat = await lstat(marker);
    } catch (error) {
      if (error.code !== "ENOENT") {
        return {
          found: true,
          root: current,
          errors: [issue({
            file: displayPath(input.projectRoot, marker),
            problem: `Bundle root marker cannot be inspected: ${error.message}`,
            fix: "Make the configured root marker readable."
          })]
        };
      }
      markerStat = null;
    }

    if (markerStat) {
      const errors = [];
      let markerRealPath = marker;
      let resolvedStat = markerStat;
      try {
        markerRealPath = await realpath(marker);
        resolvedStat = await stat(markerRealPath);
      } catch (error) {
        errors.push(issue({
          file: displayPath(input.projectRoot, marker),
          problem: `Bundle root marker cannot be resolved: ${error.message}`,
          fix: "Replace the marker with a readable regular file inside the bundle."
        }));
      }

      if (errors.length === 0 && !resolvedStat.isFile()) {
        errors.push(issue({
          file: displayPath(input.projectRoot, markerRealPath),
          problem: "Bundle root marker is not a regular file.",
          fix: "Use a regular file for the configured root marker."
        }));
      }
      if (
        errors.length === 0
        && (!isWithin(input.projectRoot, markerRealPath) || !isWithin(current, markerRealPath))
      ) {
        errors.push(issue({
          file: displayPath(input.projectRoot, marker),
          problem: "Bundle root marker resolves outside the bundle or project workspace.",
          fix: "Keep the root marker inside the bundle without an escaping symlink."
        }));
      }

      return {
        found: true,
        root: current,
        errors
      };
    }

    if (current === input.projectRoot) {
      break;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return {
    found: false,
    root: null,
    errors: []
  };
}

async function resolveMember({ role, configured, root, projectRoot }) {
  const configuredPath = path.join(root, ...configured.path.split("/"));
  let memberRealPath;
  let memberStat;

  try {
    memberRealPath = await realpath(configuredPath);
    memberStat = await stat(memberRealPath);
  } catch (error) {
    if (error.code === "ENOENT" && !configured.required) {
      return {
        member: null,
        errors: []
      };
    }
    return {
      member: null,
      errors: [issue({
        file: displayPath(projectRoot, configuredPath),
        field: `source_unit.members.${role}`,
        problem: error.code === "ENOENT"
          ? `Required Source Unit member '${role}' is missing.`
          : `Source Unit member '${role}' cannot be resolved: ${error.message}`,
        fix: `Create the configured '${configured.path}' member inside the bundle or update the Profile.`
      })]
    };
  }

  if (!isWithin(projectRoot, memberRealPath) || !isWithin(root, memberRealPath)) {
    return {
      member: null,
      errors: [issue({
        file: displayPath(projectRoot, configuredPath),
        field: `source_unit.members.${role}`,
        problem: `Source Unit member '${role}' resolves outside the bundle or project workspace.`,
        fix: "Keep every member inside the bundle without an escaping symlink."
      })]
    };
  }
  if (!memberStat.isFile()) {
    return {
      member: null,
      errors: [issue({
        file: displayPath(projectRoot, memberRealPath),
        field: `source_unit.members.${role}`,
        problem: `Source Unit member '${role}' is not a regular file.`,
        fix: "Use a supported structured regular file for the configured member."
      })]
    };
  }

  return {
    member: {
      role,
      path: displayPath(projectRoot, memberRealPath),
      absolutePath: memberRealPath
    },
    errors: []
  };
}

export function publicSourceUnit(sourceUnit) {
  if (!sourceUnit) {
    return null;
  }
  return {
    schema_version: sourceUnit.schema_version,
    kind: sourceUnit.kind,
    input_path: sourceUnit.input_path,
    root_path: sourceUnit.root_path,
    source_type: sourceUnit.source_type,
    profile_id: sourceUnit.profile_id,
    members: sourceUnit.members.map(({ role, path: memberPath }) => ({
      role,
      path: memberPath
    }))
  };
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === ""
    || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
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

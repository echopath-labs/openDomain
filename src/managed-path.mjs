import { lstat, mkdir, realpath } from "node:fs/promises";
import path from "node:path";

export async function inspectManagedFilePath(cwd, relativeFile) {
  const projectRoot = await realpath(cwd);
  const segments = managedSegments(relativeFile);
  const parentSegments = segments.slice(0, -1);
  let current = projectRoot;

  for (let index = 0; index < parentSegments.length; index += 1) {
    current = path.join(current, parentSegments[index]);
    const inspection = await inspectExistingDirectory(
      current,
      relativeFile,
      parentSegments.slice(0, index + 1).join("/")
    );
    if (inspection.issue) {
      return { projectRoot, file: path.join(projectRoot, ...segments), issue: inspection.issue };
    }
    if (!inspection.exists) {
      return { projectRoot, file: path.join(projectRoot, ...segments), issue: null };
    }
  }

  const file = path.join(projectRoot, ...segments);
  try {
    const fileStat = await lstat(file);
    if (fileStat.isSymbolicLink()) {
      return {
        projectRoot,
        file,
        issue: managedPathIssue(relativeFile, `Managed Agent file '${relativeFile}' is a symbolic link.`)
      };
    }
    if (!fileStat.isFile()) {
      return {
        projectRoot,
        file,
        issue: managedPathIssue(relativeFile, `Managed Agent file '${relativeFile}' is not a regular file.`)
      };
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      return {
        projectRoot,
        file,
        issue: managedPathIssue(relativeFile, `Managed Agent file cannot be inspected: ${error.message}`)
      };
    }
  }

  return { projectRoot, file, issue: null };
}

export async function ensureManagedFileParent(projectRoot, relativeFile) {
  const segments = managedSegments(relativeFile).slice(0, -1);
  let current = projectRoot;

  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const displayPath = segments.slice(0, index + 1).join("/");
    let inspection = await inspectExistingDirectory(current, relativeFile, displayPath);
    if (!inspection.exists) {
      try {
        await mkdir(current);
      } catch (error) {
        if (error.code !== "EEXIST") {
          throw error;
        }
      }
      inspection = await inspectExistingDirectory(current, relativeFile, displayPath);
    }
    if (inspection.issue) {
      const error = new Error(inspection.issue.problem);
      error.issue = inspection.issue;
      throw error;
    }
  }
}

async function inspectExistingDirectory(directory, relativeFile, displayPath) {
  try {
    const directoryStat = await lstat(directory);
    if (directoryStat.isSymbolicLink()) {
      return {
        exists: true,
        issue: managedPathIssue(
          relativeFile,
          `Managed Agent path parent '${displayPath}' is a symbolic link.`
        )
      };
    }
    if (!directoryStat.isDirectory()) {
      return {
        exists: true,
        issue: managedPathIssue(
          relativeFile,
          `Managed Agent path parent '${displayPath}' is not a directory.`
        )
      };
    }
    return { exists: true, issue: null };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { exists: false, issue: null };
    }
    return {
      exists: true,
      issue: managedPathIssue(relativeFile, `Managed Agent path cannot be inspected: ${error.message}`)
    };
  }
}

function managedSegments(relativeFile) {
  const segments = relativeFile.split("/");
  if (
    path.isAbsolute(relativeFile)
    || segments.length < 2
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Invalid managed Agent path '${relativeFile}'.`);
  }
  return segments;
}

function managedPathIssue(file, problem) {
  return {
    severity: "error",
    file,
    field: "$",
    problem,
    fix: "Replace symlinked or non-directory Agent path parents with real directories inside the project."
  };
}

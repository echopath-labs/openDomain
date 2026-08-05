import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const publicDocuments = [
  "README.md",
  "README.zh-CN.md",
  "USAGE.md",
  "USAGE.zh-CN.md",
  "INSTALL.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "examples/erp/README.md"
];

const pairedNavigation = new Map([
  ["README.md", ["README.zh-CN.md", "USAGE.md", "INSTALL.md"]],
  ["README.zh-CN.md", ["README.md", "USAGE.zh-CN.md", "INSTALL.md"]],
  ["USAGE.md", ["USAGE.zh-CN.md", "README.md", "INSTALL.md", "examples/erp/README.md"]],
  ["USAGE.zh-CN.md", ["USAGE.md", "README.zh-CN.md", "INSTALL.md", "examples/erp/README.md"]]
]);

const npmPackageUrl =
  "https://www.npmjs.com/package/@echopath-labs/opendomain";
const npmAlphaBadgeUrl =
  "https://img.shields.io/npm/v/%40echopath-labs%2Fopendomain/alpha?label=npm";

test("public guidance exposes paired Agent adoption entrypoints", async () => {
  for (const document of publicDocuments) {
    const details = await stat(path.join(repositoryRoot, document));
    assert.equal(details.isFile(), true, `${document} must be a public file`);
  }

  for (const [document, expectedTargets] of pairedNavigation) {
    const content = await readDocument(document);
    const targets = new Set(extractMarkdownLinks(content).map(({ target }) => {
      return normalizeLinkTarget(target, document).file;
    }));

    for (const expectedTarget of expectedTargets) {
      assert.ok(
        targets.has(expectedTarget),
        `${document} must link to ${expectedTarget}`
      );
    }
  }
});

test("public READMEs expose the same alpha-aware npm package entrypoint", async () => {
  const expectedBadge = `[![npm](${npmAlphaBadgeUrl})](${npmPackageUrl})`;

  for (const document of ["README.md", "README.zh-CN.md"]) {
    const content = await readDocument(document);
    assert.equal(
      content.split(expectedBadge).length - 1,
      1,
      `${document} must contain exactly one linked npm alpha badge`
    );
  }
});

test("public Markdown links resolve without private process records", async () => {
  for (const document of publicDocuments) {
    const content = await readDocument(document);
    for (const { target, line } of extractMarkdownLinks(content)) {
      if (isExternalLink(target)) {
        continue;
      }

      const resolved = normalizeLinkTarget(target, document);
      assert.doesNotMatch(
        resolved.file,
        /^(?:docs|openspec)(?:\/|$)/,
        `${document}:${line} links to a private process path`
      );

      const details = await stat(path.join(repositoryRoot, resolved.file));
      assert.equal(
        details.isFile(),
        true,
        `${document}:${line} target is not a file: ${resolved.file}`
      );

      if (resolved.anchor) {
        const targetContent = await readDocument(resolved.file);
        assert.ok(
          markdownAnchors(targetContent).has(resolved.anchor),
          `${document}:${line} has an unknown anchor: ${target}`
        );
      }
    }
  }
});

test("documented OpenDomain commands belong to the current CLI", async () => {
  const cli = path.join(repositoryRoot, "bin", "opendomain.mjs");
  const { stdout } = await execFile(process.execPath, [cli, "--help"], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  const supportedCommands = new Set(extractOpenDomainCommands(stdout).map(commandSignature));

  for (const document of publicDocuments) {
    const content = await readDocument(document);
    for (const command of extractOpenDomainCommands(content)) {
      const signature = commandSignature(command);
      assert.ok(
        supportedCommands.has(signature),
        `${document} documents an unsupported command: ${command}`
      );
    }
  }
});

async function readDocument(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function extractMarkdownLinks(content) {
  const links = [];
  const pattern = /!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    links.push({
      target: match[1],
      line: content.slice(0, match.index).split("\n").length
    });
  }

  return links;
}

function isExternalLink(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target);
}

function normalizeLinkTarget(target, sourceDocument) {
  const [rawFile, rawAnchor = ""] = target.split("#", 2);
  const sourceDirectory = path.posix.dirname(sourceDocument);
  const decodedFile = decodeURIComponent(rawFile || path.posix.basename(sourceDocument));
  const file = path.posix.normalize(path.posix.join(sourceDirectory, decodedFile));

  assert.notEqual(file, "..", `${sourceDocument} link escapes the repository`);
  assert.equal(
    file.startsWith("../"),
    false,
    `${sourceDocument} link escapes the repository: ${target}`
  );

  return {
    file,
    anchor: decodeURIComponent(rawAnchor).toLowerCase()
  };
}

function markdownAnchors(content) {
  const counts = new Map();
  const anchors = new Set();

  for (const line of content.split("\n")) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) {
      continue;
    }

    const base = match[2]
      .trim()
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }

  return anchors;
}

function extractOpenDomainCommands(content) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("opendomain "))
    .map((line) => line.replace(/^opendomain\s+/, "").trim());
}

function commandSignature(command) {
  const words = command.split(/\s+/).filter((word) => !word.startsWith("--"));
  if (command.startsWith("--version") || command.startsWith("-v")) {
    return "--version";
  }

  const first = words[0];
  if (["candidate", "index", "integrations", "ids", "refs", "demo"].includes(first)) {
    return `${first} ${words[1]}`;
  }
  return first;
}

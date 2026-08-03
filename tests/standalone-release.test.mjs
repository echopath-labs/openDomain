import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function loadReleaseModule() {
  try {
    return await import("../scripts/lib/standalone-release.mjs");
  } catch (error) {
    assert.fail(`Standalone release contract is unavailable: ${error.code ?? error.message}`);
  }
}

test("standalone release contract maps only declared native targets", async () => {
  const release = await loadReleaseModule();

  assert.equal(release.hostStandaloneTarget("darwin", "arm64"), "darwin-arm64");
  assert.equal(release.hostStandaloneTarget("darwin", "x64"), "darwin-x64");
  assert.equal(release.hostStandaloneTarget("linux", "x64"), "linux-x64");
  assert.equal(release.hostStandaloneTarget("win32", "x64"), "windows-x64");
  assert.throws(() => release.hostStandaloneTarget("linux", "arm64"), /Unsupported standalone host/);
  assert.throws(
    () => release.assertNativeStandaloneTarget("darwin-x64", "darwin", "arm64"),
    /does not match native host 'darwin-arm64'/
  );
  assert.equal(release.assertStandaloneNodeVersion("24.18.0"), "24.18.0");
  assert.throws(
    () => release.assertStandaloneNodeVersion("24.15.0"),
    /require Node 24\.18\.0/
  );
  assert.equal(release.standalonePathsOverlap("/tmp/artifacts", "/tmp/artifacts", "linux"), true);
  assert.equal(release.standalonePathsOverlap("/tmp/artifacts", "/tmp/artifacts/release", "linux"), true);
  assert.equal(release.standalonePathsOverlap("/tmp/artifacts/release", "/tmp/artifacts", "linux"), true);
  assert.equal(release.standalonePathsOverlap("/tmp/artifacts", "/tmp/release", "linux"), false);
  assert.equal(
    release.standalonePathsOverlap(
      "C:\\Repo\\Artifacts",
      "c:\\repo\\artifacts\\release",
      "win32"
    ),
    true
  );
});

test("standalone asset names bind package version and target", async () => {
  const release = await loadReleaseModule();
  const version = "0.1.0-alpha.7";

  assert.deepEqual(
    release.STANDALONE_TARGETS.map((target) => release.standaloneAssetName(version, target)),
    [
      "opendomain-v0.1.0-alpha.7-darwin-arm64",
      "opendomain-v0.1.0-alpha.7-darwin-x64",
      "opendomain-v0.1.0-alpha.7-linux-x64",
      "opendomain-v0.1.0-alpha.7-windows-x64.exe"
    ]
  );

  assert.equal(release.assertReleaseTagVersion("v0.1.0-alpha.7", version), version);
  assert.throws(
    () => release.assertReleaseTagVersion("v0.1.0-alpha.8", version),
    /does not match package version/
  );
  assert.throws(
    () => release.assertReleaseTagVersion("0.1.0-alpha.7", version),
    /must use the form 'v<package-version>'/
  );
});

test("checksum manifest is deterministic and requires the complete matrix", async () => {
  const release = await loadReleaseModule();
  const directory = await mkdtemp(path.join(os.tmpdir(), "opendomain-release-assets-"));
  const version = "0.1.0-alpha.7";

  try {
    const names = release.STANDALONE_TARGETS.map((target) => (
      release.standaloneAssetName(version, target)
    ));
    for (const name of [...names].reverse()) {
      await writeFile(path.join(directory, name), `${name}\n`, "utf8");
    }

    const manifest = await release.createStandaloneChecksumManifest(directory, version);
    const expected = [...names].sort().map((name) => {
      const hash = createHash("sha256").update(`${name}\n`).digest("hex");
      return `${hash}  ${name}`;
    }).join("\n");

    assert.equal(manifest, `${expected}\n`);

    await rm(path.join(directory, names[0]));
    await assert.rejects(
      release.createStandaloneChecksumManifest(directory, version),
      /missing standalone release assets/
    );

    await writeFile(path.join(directory, names[0]), `${names[0]}\n`, "utf8");
    await writeFile(path.join(directory, "unexpected.bin"), "unexpected\n", "utf8");
    await assert.rejects(
      release.createStandaloneChecksumManifest(directory, version),
      /unexpected standalone release assets/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("release assembly preserves artifact boundaries before flattening", async () => {
  const release = await loadReleaseModule();
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "opendomain-native-artifacts-"));
  const root = path.join(temporaryRoot, "artifacts");
  const output = path.join(temporaryRoot, "release");
  const version = "0.1.0-alpha.7";

  try {
    await mkdir(root);
    for (const target of release.STANDALONE_TARGETS) {
      const artifactDirectory = path.join(root, `standalone-${target}`);
      await mkdir(artifactDirectory);
      const asset = release.standaloneAssetName(version, target);
      await writeFile(path.join(artifactDirectory, asset), `${target}\n`, "utf8");
    }

    await release.assembleStandaloneReleaseAssets(root, output, version);
    assert.deepEqual(
      (await readdir(output)).sort(),
      release.STANDALONE_TARGETS
        .map((target) => release.standaloneAssetName(version, target))
        .sort()
    );

    const protectedOutput = path.join(temporaryRoot, "existing-output");
    const sentinel = path.join(protectedOutput, "keep.txt");
    await mkdir(protectedOutput);
    await writeFile(sentinel, "keep\n", "utf8");
    await assert.rejects(
      release.assembleStandaloneReleaseAssets(root, protectedOutput, version),
      /must not already exist/
    );
    assert.equal(await readFile(sentinel, "utf8"), "keep\n");

    const artifactAlias = path.join(temporaryRoot, "artifact-alias");
    await symlink(root, artifactAlias, "dir");
    await assert.rejects(
      release.assembleStandaloneReleaseAssets(
        root,
        path.join(artifactAlias, "release"),
        version
      ),
      /must not overlap/
    );

    const wrongDirectory = path.join(root, "standalone-darwin-x64");
    await writeFile(
      path.join(wrongDirectory, release.standaloneAssetName(version, "darwin-arm64")),
      "duplicate target asset\n",
      "utf8"
    );
    await assert.rejects(
      release.assembleStandaloneReleaseAssets(root, output, version),
      /unexpected files in native artifact/
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

# OpenDomain Agent Installation Contract

This is the canonical installation contract for shell-capable AI agents.
For the human-facing workflow, see the [English Usage Guide](USAGE.md) or
[Simplified Chinese Usage Guide](USAGE.zh-CN.md).

When a user asks you to install OpenDomain in the current workspace, complete
this workflow unless the user's instructions or repository policy are stricter.
Do not add OpenDomain to the project's dependencies, scripts, package manifest,
or lockfiles.

## Preconditions

Before changing anything:

1. Confirm the intended workspace root and inspect its repository instructions.
2. Confirm that shell execution and writes to the workspace are allowed.
3. Confirm that network access is available for a new installation or upgrade.
4. Preserve existing project files and report any ownership conflict.

Installation can require the user's approval because it changes their tool
environment. Never bypass an approval boundary, expose credentials, disable
integrity checks, or silently escalate privileges. If a precondition is not
available, stop and report the exact blocker and any changes already made.

## Select An Installation Path

First run `opendomain --version` if `opendomain` is already on `PATH`. A usable
existing CLI does not need to be installed again; continue with workspace
initialization or update below.

### npm Alpha Channel

Prefer npm when a supported Node.js and npm tool environment is already
available. OpenDomain currently supports Node.js 20 or Node.js 22 and newer;
Node.js 21 is not supported.

During the prerelease period, always name the alpha distribution tag:

```bash
npm install --global @echopath-labs/opendomain@alpha
opendomain --version
```

This is a global tool installation. Do not run `npm install` without
`--global` from the user's project. If the configured global prefix is not
writable, use a user-owned npm prefix or ask the user to approve an appropriate
environment change. Do not use `sudo npm install` by default.

### Verified Standalone Executable

Use the standalone fallback when a compatible npm environment is unavailable:

1. Open the official [OpenDomain releases](https://github.com/echopath-labs/openDomain/releases)
   and select the intended release, normally the newest non-draft release.
2. Detect the operating system and architecture, then select the matching
   `opendomain-v<version>-<target>` asset. Windows assets end in `.exe`.
3. Download that executable and `SHA256SUMS.txt` from the same release.
4. Verify the executable against its exact line in the checksum manifest using
   `shasum -a 256` on macOS, `sha256sum` on Linux, or `Get-FileHash -Algorithm
   SHA256` in PowerShell.
5. Only after verification, place it as `opendomain` (or `opendomain.exe`) in a
   user-writable executable directory on `PATH`, such as `$HOME/.local/bin`.
6. Run `opendomain --version` and confirm the expected version.

Supported standalone targets and minimum systems are listed under
[Installation channels](USAGE.md#installation-channels). Never execute an asset when
the matching checksum is absent or different. Do not silently use `sudo` to
write to a system directory.

## Initialize The Current Workspace

After the CLI is available, stay in the intended repository root.

If `opendomain/config.yaml` already exists and selects Codex, synchronize the
managed integration:

```bash
opendomain update --json
```

Otherwise initialize the canonical workspace and Codex adapter:

```bash
opendomain init --tools codex --json
```

Initialization may create the canonical `opendomain/` workspace, generated
`.codex/skills/opendomain-*` Skills, and one managed OpenDomain block in
`AGENTS.md`. It must preserve user-owned content and existing package metadata.

## Prove Readiness

Run both checks before reporting success:

```bash
opendomain doctor --json
opendomain validate --json
```

Installation is complete only when the CLI version command, initialization or
update, diagnostics, and validation all exit successfully. Report:

- the installed OpenDomain version and installation path;
- whether the workspace was initialized or updated;
- the managed files created or updated;
- the `doctor` and `validate` outcomes;
- confirmation that project package metadata was not created or modified.

If any command fails, report that command and its actionable diagnostic. Do not
claim that automatic Agent use is ready. Once the generated Codex integration
is healthy, its repository instructions and Skills route grounding assurance,
domain exploration, candidate-first modeling, and Candidate review.

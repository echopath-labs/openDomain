import assert from "node:assert/strict";
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse as parseYaml } from "yaml";
import { runCli } from "../src/cli.mjs";

test("init --tools codex installs Agent integration without host package metadata", async () => {
  await withTempProject(async (cwd) => {
    const stdout = memoryStream();
    const exitCode = await runCli(["init", "--tools", "codex", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 0);
    assert.deepEqual(payload.tools, ["codex"]);
    assert.deepEqual(
      parseYaml(await readFile(path.join(cwd, "opendomain/config.yaml"), "utf8")),
      {
        schema_version: "1",
        agent_integration: {
          adapter_version: "1",
          tools: ["codex"]
        }
      }
    );
    await access(path.join(cwd, ".codex/skills/opendomain-explore/SKILL.md"));
    await access(path.join(cwd, ".codex/skills/opendomain-model/SKILL.md"));
    await access(path.join(cwd, ".codex/skills/opendomain-review/SKILL.md"));

    const agents = await readFile(path.join(cwd, "AGENTS.md"), "utf8");
    assert.match(agents, /<!-- opendomain:managed:start -->/);
    assert.match(agents, /opendomain assure <source-unit>/);
    assert.match(agents, /<!-- opendomain:managed:end -->/);
    await assert.rejects(access(path.join(cwd, "package.json")), { code: "ENOENT" });
    await assert.rejects(access(path.join(cwd, "package-lock.json")), { code: "ENOENT" });
  });
});

test("init preserves existing AGENTS content and updates one idempotent managed block", async () => {
  await withTempProject(async (cwd) => {
    const original = "# Existing Rules\n\nKeep this user-owned instruction.\n";
    await writeFile(path.join(cwd, "AGENTS.md"), original, "utf8");

    const firstExitCode = await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    });
    const afterFirst = await readFile(path.join(cwd, "AGENTS.md"), "utf8");

    assert.equal(firstExitCode, 0);
    assert.ok(afterFirst.startsWith(original));
    assert.equal(countMatches(afterFirst, "<!-- opendomain:managed:start -->"), 1);
    assert.equal(countMatches(afterFirst, "<!-- opendomain:managed:end -->"), 1);

    const secondExitCode = await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    });
    const afterSecond = await readFile(path.join(cwd, "AGENTS.md"), "utf8");

    assert.equal(secondExitCode, 0);
    assert.equal(afterSecond, afterFirst);
  });
});

test("init rejects malformed managed markers before mutating the project", async () => {
  await withTempProject(async (cwd) => {
    const malformed = "# Existing Rules\n\n<!-- opendomain:managed:start -->\nunfinished\n";
    await writeFile(path.join(cwd, "AGENTS.md"), malformed, "utf8");
    const stdout = memoryStream();

    const exitCode = await runCli(["init", "--tools", "codex", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 1);
    assert.ok(payload.errors.some((issue) => issue.problem.includes("managed markers")));
    assert.equal(await readFile(path.join(cwd, "AGENTS.md"), "utf8"), malformed);
    await assert.rejects(access(path.join(cwd, "opendomain")), { code: "ENOENT" });
    await assert.rejects(access(path.join(cwd, ".codex")), { code: "ENOENT" });
  });
});

test("init rejects a non-file AGENTS path with structured diagnostics", async () => {
  await withTempProject(async (cwd) => {
    await mkdir(path.join(cwd, "AGENTS.md"));
    const stdout = memoryStream();

    const exitCode = await runCli(["init", "--tools", "codex", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 1);
    assert.ok(payload.errors.some((issue) => (
      issue.file === "AGENTS.md"
      && issue.problem.includes("not a regular file")
    )));
    await assert.rejects(access(path.join(cwd, "opendomain")), { code: "ENOENT" });
  });
});

test("integration commands reject a non-file workspace configuration with JSON diagnostics", async () => {
  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);
    const config = path.join(cwd, "opendomain/config.yaml");
    const agents = path.join(cwd, "AGENTS.md");
    const agentsBefore = await readFile(agents, "utf8");
    await rm(config);
    await mkdir(config);

    for (const args of [
      ["init", "--tools", "codex", "--json"],
      ["update", "--json"],
      ["doctor", "--json"]
    ]) {
      const stdout = memoryStream();
      const exitCode = await runCli(args, {
        cwd,
        stdout,
        stderr: memoryStream()
      });
      const payload = JSON.parse(stdout.toString());

      assert.equal(exitCode, 1);
      assert.ok(payload.errors.some((issue) => (
        issue.file === "opendomain/config.yaml"
        && issue.problem.includes("not a regular file")
      )));
      assert.equal(await readFile(agents, "utf8"), agentsBefore);
    }
  });
});

test("integration commands route dangling config symlinks through boundary validation", async (t) => {
  if (process.platform === "win32") {
    t.skip("Windows symlink creation requires privileges unavailable in standard CI.");
    return;
  }

  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);
    const config = path.join(cwd, "opendomain/config.yaml");
    await rm(config);
    await symlink(path.join(cwd, "missing-config.yaml"), config);

    for (const args of [
      ["init", "--tools", "codex", "--json"],
      ["update", "--json"],
      ["doctor", "--json"]
    ]) {
      const stdout = memoryStream();
      const exitCode = await runCli(args, {
        cwd,
        stdout,
        stderr: memoryStream()
      });
      const payload = JSON.parse(stdout.toString());

      assert.equal(exitCode, 1);
      assert.ok(payload.errors.some((issue) => (
        issue.file === "opendomain/config.yaml"
        && issue.problem.includes("must not be a symbolic link")
      )));
    }
  });
});

test("integration commands report an unreadable generated Skill", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX file permissions are required for this regression test.");
    return;
  }

  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);
    const skill = path.join(cwd, ".codex/skills/opendomain-explore/SKILL.md");
    await chmod(skill, 0o000);

    try {
      for (const args of [
        ["init", "--tools", "codex", "--json"],
        ["update", "--json"],
        ["doctor", "--json"]
      ]) {
        const stdout = memoryStream();
        const exitCode = await runCli(args, {
          cwd,
          stdout,
          stderr: memoryStream()
        });
        const payload = JSON.parse(stdout.toString());

        assert.equal(exitCode, 1);
        assert.ok(payload.errors.some((issue) => (
          issue.file.endsWith("opendomain-explore/SKILL.md")
          && issue.problem.includes("cannot be read")
        )));
      }
    } finally {
      await chmod(skill, 0o600);
    }
  });
});

test("managed writes do not follow a pre-existing temporary-file symlink", async (t) => {
  if (process.platform === "win32") {
    t.skip("Windows symlink creation requires privileges unavailable in standard CI.");
    return;
  }

  await withTempProject(async (cwd) => {
    const victim = path.join(cwd, "user-owned.txt");
    const victimContent = "user-owned content\n";
    await writeFile(victim, victimContent, "utf8");
    await symlink(
      victim,
      path.join(cwd, `AGENTS.md.opendomain-${process.pid}.tmp`)
    );

    const exitCode = await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    });

    assert.equal(exitCode, 0);
    assert.equal(await readFile(victim, "utf8"), victimContent);
    assert.equal((await lstat(path.join(cwd, "AGENTS.md"))).isSymbolicLink(), false);
  });
});

test("update preserves modes when replacing existing managed files", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX file modes are required for this regression test.");
    return;
  }

  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);

    const config = path.join(cwd, "opendomain/config.yaml");
    const agents = path.join(cwd, "AGENTS.md");
    const skill = path.join(cwd, ".codex/skills/opendomain-model/SKILL.md");
    await writeFile(
      config,
      `agent_integration:\n  tools: [codex]\n  adapter_version: "1"\nschema_version: "1"\n`,
      "utf8"
    );
    await writeFile(
      agents,
      (await readFile(agents, "utf8")).replace(
        "This repository uses OpenDomain",
        "STALE managed block uses OpenDomain"
      ),
      "utf8"
    );
    await writeFile(skill, `${await readFile(skill, "utf8")}\nSTALE GENERATED CONTENT\n`, "utf8");
    await chmod(config, 0o600);
    await chmod(agents, 0o640);
    await chmod(skill, 0o604);

    assert.equal(await runCli(["update"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);
    assert.equal((await lstat(config)).mode & 0o7777, 0o600);
    assert.equal((await lstat(agents)).mode & 0o7777, 0o640);
    assert.equal((await lstat(skill)).mode & 0o7777, 0o604);
    assert.doesNotMatch(await readFile(agents, "utf8"), /STALE managed block/);
    assert.doesNotMatch(await readFile(skill, "utf8"), /STALE GENERATED CONTENT/);
  });
});

test("init rejects a symlinked generated Skill parent before workspace mutation", async (t) => {
  if (process.platform === "win32") {
    t.skip("Windows symlink creation requires privileges unavailable in standard CI.");
    return;
  }

  const external = await mkdtemp(path.join(os.tmpdir(), "opendomain-external-skills-"));
  try {
    await withTempProject(async (cwd) => {
      await symlink(external, path.join(cwd, ".codex"));
      const stdout = memoryStream();

      const exitCode = await runCli(["init", "--tools", "codex", "--json"], {
        cwd,
        stdout,
        stderr: memoryStream()
      });
      const payload = JSON.parse(stdout.toString());

      assert.equal(exitCode, 1);
      assert.ok(payload.errors.some((issue) => (
        issue.file.includes(".codex/skills/")
        && issue.problem.includes("symbolic link")
      )));
      assert.deepEqual(await readdir(external), []);
      await assert.rejects(access(path.join(cwd, "opendomain")), { code: "ENOENT" });
      await assert.rejects(access(path.join(cwd, "AGENTS.md")), { code: "ENOENT" });
    });
  } finally {
    await rm(external, { recursive: true, force: true });
  }
});

test("init --tools codex upgrades an existing unconfigured workspace", async () => {
  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);

    const stdout = memoryStream();
    const exitCode = await runCli(["init", "--tools", "codex", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const config = parseYaml(
      await readFile(path.join(cwd, "opendomain/config.yaml"), "utf8")
    );

    assert.equal(exitCode, 0);
    assert.deepEqual(config.agent_integration.tools, ["codex"]);
    assert.ok(JSON.parse(stdout.toString()).updated.some((item) => (
      item.path === "opendomain/config.yaml"
    )));
  });
});

test("init refuses to overwrite a user-owned Codex Skill", async () => {
  await withTempProject(async (cwd) => {
    const skill = path.join(cwd, ".codex/skills/opendomain-explore/SKILL.md");
    await mkdir(path.dirname(skill), { recursive: true });
    await writeFile(skill, "user-owned skill\n", "utf8");
    const stdout = memoryStream();

    const exitCode = await runCli(["init", "--tools", "codex", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 1);
    assert.ok(payload.errors.some((issue) => issue.problem.includes("not OpenDomain-generated")));
    assert.equal(await readFile(skill, "utf8"), "user-owned skill\n");
    await assert.rejects(access(path.join(cwd, "opendomain")), { code: "ENOENT" });
  });
});

test("update synchronizes only managed Agent resources", async () => {
  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);

    const concept = path.join(cwd, "opendomain/concepts/example.concept.md");
    const conceptBefore = await readFile(concept, "utf8");
    const skill = path.join(cwd, ".codex/skills/opendomain-explore/SKILL.md");
    await writeFile(skill, `${await readFile(skill, "utf8")}\nSTALE GENERATED CONTENT\n`, "utf8");
    const agents = path.join(cwd, "AGENTS.md");
    const currentAgents = await readFile(agents, "utf8");
    await writeFile(
      agents,
      `# User Rules\n\n${currentAgents.replace("This repository uses OpenDomain", "STALE managed block uses OpenDomain")}`,
      "utf8"
    );
    const stdout = memoryStream();

    const exitCode = await runCli(["update", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());
    const updatedAgents = await readFile(agents, "utf8");

    assert.equal(exitCode, 0);
    assert.ok(payload.updated.some((item) => item.path === "AGENTS.md"));
    assert.ok(payload.updated.some((item) => item.path.endsWith("opendomain-explore/SKILL.md")));
    assert.doesNotMatch(await readFile(skill, "utf8"), /STALE GENERATED CONTENT/);
    assert.ok(updatedAgents.startsWith("# User Rules\n\n"));
    assert.doesNotMatch(updatedAgents, /STALE managed block/);
    assert.equal(await readFile(concept, "utf8"), conceptBefore);
    await assert.rejects(access(path.join(cwd, "package.json")), { code: "ENOENT" });
  });
});

test("update removes generated Skills after Codex is explicitly deselected", async () => {
  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);
    const config = path.join(cwd, "opendomain/config.yaml");
    await writeFile(config, `schema_version: "1"\nagent_integration:\n  adapter_version: "1"\n  tools: []\n`, "utf8");
    const skillFiles = ["opendomain-explore", "opendomain-model", "opendomain-review"]
      .map((name) => path.join(cwd, `.codex/skills/${name}/SKILL.md`));
    const doctorStdout = memoryStream();

    assert.equal(await runCli(["doctor", "--json"], {
      cwd,
      stdout: doctorStdout,
      stderr: memoryStream()
    }), 1);
    assert.ok(JSON.parse(doctorStdout.toString()).errors.some((issue) => (
      issue.problem.includes("no longer selected")
      && issue.fix === "Run opendomain update."
    )));
    await Promise.all(skillFiles.map((file) => access(file)));

    const updateStdout = memoryStream();
    assert.equal(await runCli(["update", "--json"], {
      cwd,
      stdout: updateStdout,
      stderr: memoryStream()
    }), 0);
    const update = JSON.parse(updateStdout.toString());

    assert.equal(update.removed.length, 3);
    await Promise.all(skillFiles.map((file) => (
      assert.rejects(access(file), { code: "ENOENT" })
    )));
    const finalDoctorStdout = memoryStream();
    assert.equal(await runCli(["doctor", "--json"], {
      cwd,
      stdout: finalDoctorStdout,
      stderr: memoryStream()
    }), 0);
    assert.equal(JSON.parse(finalDoctorStdout.toString()).status, "healthy");
  });
});

test("doctor reports a healthy initialized Codex integration without mutation", async () => {
  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);
    const agents = path.join(cwd, "AGENTS.md");
    const agentsBefore = await readFile(agents, "utf8");
    const stdout = memoryStream();

    const exitCode = await runCli(["doctor", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 0);
    assert.equal(payload.status, "healthy");
    assert.deepEqual(payload.tools, ["codex"]);
    assert.ok(payload.checks.every((check) => check.status === "pass"));
    assert.equal(await readFile(agents, "utf8"), agentsBefore);
  });
});

test("doctor reports a missing configured Skill without repairing it", async () => {
  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);
    const missingSkill = path.join(cwd, ".codex/skills/opendomain-review/SKILL.md");
    await rm(missingSkill);
    const agents = path.join(cwd, "AGENTS.md");
    const agentsBefore = await readFile(agents, "utf8");
    const stdout = memoryStream();

    const exitCode = await runCli(["doctor", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 1);
    assert.equal(payload.status, "unhealthy");
    assert.ok(payload.errors.some((issue) => (
      issue.file.endsWith("opendomain-review/SKILL.md")
      && issue.problem.includes("missing")
      && issue.fix === "Run opendomain update."
    )));
    await assert.rejects(access(missingSkill), { code: "ENOENT" });
    assert.equal(await readFile(agents, "utf8"), agentsBefore);
  });
});

test("doctor reports a stale configured Skill without rewriting it", async () => {
  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);
    const staleSkill = path.join(cwd, ".codex/skills/opendomain-model/SKILL.md");
    const staleContent = `${await readFile(staleSkill, "utf8")}\nSTALE GENERATED CONTENT\n`;
    await writeFile(staleSkill, staleContent, "utf8");
    const stdout = memoryStream();

    const exitCode = await runCli(["doctor", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 1);
    assert.equal(payload.status, "unhealthy");
    assert.ok(payload.errors.some((issue) => (
      issue.file.endsWith("opendomain-model/SKILL.md")
      && issue.problem.includes("stale")
      && issue.fix === "Run opendomain update."
    )));
    assert.equal(await readFile(staleSkill, "utf8"), staleContent);
  });
});

test("update requires explicit managed integration adoption", async () => {
  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);
    await rm(path.join(cwd, "opendomain/config.yaml"));
    const concept = path.join(cwd, "opendomain/concepts/example.concept.md");
    const conceptBefore = await readFile(concept, "utf8");
    const agents = path.join(cwd, "AGENTS.md");
    const agentsBefore = await readFile(agents, "utf8");
    const stdout = memoryStream();

    const exitCode = await runCli(["update", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 1);
    assert.ok(payload.errors.some((issue) => (
      issue.file === "opendomain/config.yaml"
      && issue.problem.includes("has not adopted managed Agent integration")
    )));
    assert.equal(await readFile(concept, "utf8"), conceptBefore);
    assert.equal(await readFile(agents, "utf8"), agentsBefore);
    await assert.rejects(access(path.join(cwd, ".codex")), { code: "ENOENT" });
  });
});

test("update fails closed on invalid workspace configuration", async () => {
  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);
    const config = path.join(cwd, "opendomain/config.yaml");
    await writeFile(config, `schema_version: "1"\nagent_integration:\n  adapter_version: "1"\n  tools:\n    - unknown-agent\n`, "utf8");
    const agents = path.join(cwd, "AGENTS.md");
    const agentsBefore = await readFile(agents, "utf8");
    const stdout = memoryStream();

    const exitCode = await runCli(["update", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 1);
    assert.ok(payload.errors.some((issue) => (
      issue.file === "opendomain/config.yaml"
      && issue.field === "agent_integration.tools[0]"
    )));
    assert.equal(await readFile(agents, "utf8"), agentsBefore);
  });
});

test("doctor refuses a workspace created by a newer adapter contract", async () => {
  await withTempProject(async (cwd) => {
    assert.equal(await runCli(["init", "--tools", "codex"], {
      cwd,
      stdout: memoryStream(),
      stderr: memoryStream()
    }), 0);
    const config = path.join(cwd, "opendomain/config.yaml");
    await writeFile(config, `schema_version: "1"\nagent_integration:\n  adapter_version: "2"\n  tools:\n    - codex\n`, "utf8");
    const agents = path.join(cwd, "AGENTS.md");
    const agentsBefore = await readFile(agents, "utf8");
    const stdout = memoryStream();

    const exitCode = await runCli(["doctor", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 1);
    assert.ok(payload.errors.some((issue) => (
      issue.field === "agent_integration.adapter_version"
      && issue.problem.includes("newer adapter contract '2'")
      && issue.fix.includes("newer OpenDomain CLI")
    )));
    assert.equal(await readFile(agents, "utf8"), agentsBefore);
  });
});

test("missing --tools value preserves a trailing --json flag", async () => {
  await withTempProject(async (cwd) => {
    const stdout = memoryStream();

    const exitCode = await runCli(["init", "--tools", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 1);
    assert.ok(payload.errors.some((issue) => (
      issue.field === "tools"
      && issue.problem === "Missing Agent tool selection."
    )));
    await assert.rejects(access(path.join(cwd, "opendomain")), { code: "ENOENT" });
  });
});

test("unsupported init tool fails before project mutation", async () => {
  await withTempProject(async (cwd) => {
    const stdout = memoryStream();
    const exitCode = await runCli(["init", "--tools", "unknown-agent", "--json"], {
      cwd,
      stdout,
      stderr: memoryStream()
    });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 1);
    assert.ok(payload.errors.some((issue) => (
      issue.field === "tools" && issue.fix.includes("--tools codex")
    )));
    await assert.rejects(access(path.join(cwd, "opendomain")), { code: "ENOENT" });
    await assert.rejects(access(path.join(cwd, "AGENTS.md")), { code: "ENOENT" });
  });
});

async function withTempProject(callback) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "opendomain-agent-workspace-"));
  try {
    await callback(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

function memoryStream() {
  let output = "";
  return {
    write(chunk) {
      output += String(chunk);
    },
    toString() {
      return output;
    }
  };
}

function countMatches(value, needle) {
  return value.split(needle).length - 1;
}

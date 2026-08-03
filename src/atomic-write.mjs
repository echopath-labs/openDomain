import { randomUUID } from "node:crypto";
import { lstat, open, rename, rm } from "node:fs/promises";

export async function atomicWriteUtf8(file, content) {
  const temporary = `${file}.opendomain-${process.pid}-${randomUUID()}.tmp`;
  const existingMode = await regularFileMode(file);
  let handle = null;

  try {
    handle = await open(temporary, "wx", existingMode ?? 0o666);
    await handle.writeFile(content, { encoding: "utf8" });
    if (existingMode !== null) {
      await handle.chmod(existingMode);
    }
    await handle.close();
    handle = null;
    await rename(temporary, file);
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function regularFileMode(file) {
  try {
    const fileStat = await lstat(file);
    if (!fileStat.isFile()) {
      throw new Error(`Atomic write target '${file}' is not a regular file.`);
    }
    return fileStat.mode & 0o7777;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(process.env.PROJECT_WORKSPACES || "/srv/sulayer/workspaces");

function isAllowedRepository(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "ssh:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

function run(command: string, args: string[], cwd?: string) {
  return new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: "ignore", timeout: 10 * 60_000 });
    child.once("error", rejectRun); child.once("exit", (code) => code === 0 ? resolveRun() : rejectRun(new Error(`${command} exited with code ${code ?? "unknown"}.`)));
  });
}

export async function prepareWorkspace(project: { id: string; slug: string; sourceType: string; repositoryUrl: string | null; branch: string | null }) {
  const directory = resolve(root, project.id);
  if (!directory.startsWith(`${root}\\`) && !directory.startsWith(`${root}/`)) throw new Error("Workspace path rejected.");
  await rm(directory, { recursive: true, force: true }); await mkdir(directory, { recursive: true, mode: 0o750 });
  if (["GITHUB", "GIT"].includes(project.sourceType)) {
    if (!project.repositoryUrl || !isAllowedRepository(project.repositoryUrl)) throw new Error("Repository URL must be credential-free HTTPS or SSH.");
    await run("git", ["clone", "--depth", "1", "--branch", project.branch || "main", project.repositoryUrl, directory]);
  } else if (project.sourceType === "EMPTY") {
    await writeFile(join(directory, "README.md"), `# ${project.slug}\n\nManaged empty project. Add source through the authenticated upload API before deployment.\n`, { mode: 0o640 });
  }
  const files = await readdir(directory).catch(() => []);
  if (!files.length) throw new Error("No deployable source files are available. Upload a validated archive or connect an authorized repository.");
  return directory;
}

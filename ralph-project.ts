import { execFile } from "node:child_process";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

const exec = promisify(execFile);
const commandSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  command: z.array(z.string().min(1)).min(1),
}).strict();
const configSchema = z.object({
  checks: z.array(commandSchema).min(1),
  browser: z.boolean(),
}).strict();
export type ProjectVerification = z.infer<typeof configSchema> & { notes: string[] };

async function exists(file: string) {
  try { await access(file); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function resolveVerification(root: string, requireTests = false): Promise<ProjectVerification> {
  const config = path.join(root, "ralph.config.json");
  if (await exists(config)) {
    return { ...configSchema.parse(JSON.parse(await readFile(config, "utf8"))), notes: [] };
  }
  if (await exists(path.join(root, "package.json"))) {
    return { checks: ["lint", "typecheck", "test", "build"].map(name => ({ name, command: ["npm", "run", name] })), browser: true, notes: [] };
  }
  if (await exists(path.join(root, "pyproject.toml"))) {
    const project = await readFile(path.join(root, "pyproject.toml"), "utf8");
    const python = await exists(path.join(root, "uv.lock")) ? ["uv", "run", "--locked", "python"] : ["python3"];
    const { stdout } = await exec("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "*.py"], { cwd: root });
    const files = [...new Set(stdout.split("\0").filter(Boolean))].sort();
    if (!files.length) throw new Error("Python project has no Python source files; configure real checks in ralph.config.json");
    const checks = [{ name: "python-syntax", command: [...python, "-m", "py_compile", ...files] }];
    const notes: string[] = [];
    if (/\bpytest\b/.test(project) || await exists(path.join(root, "pytest.ini"))) {
      checks.push({ name: "test", command: [...python, "-m", "pytest"] });
    } else {
      const tests = files.filter(file => /(^|\/)test[^/]*\.py$/.test(file));
      if (tests.length) {
        // Explicit discovery directories avoid silently missing tests in non-package directories.
        const dirs = [...new Set(tests.map(file => path.dirname(file)))];
        for (const [index, dir] of dirs.entries()) {
          checks.push({ name: `test-${index + 1}`, command: [...python, "-c",
            "import sys, unittest; suite = unittest.defaultTestLoader.discover(sys.argv[1]); count = suite.countTestCases(); result = unittest.TextTestRunner(verbosity=2).run(suite); sys.exit(0 if count > 0 and result.wasSuccessful() else 1)", dir] });
        }
      } else if (requireTests) {
        throw new Error("Python verification requires tests. Add unittest test_*.py tests or configure the project's test command in ralph.config.json");
      } else {
        notes.push("No Python tests exist yet. Baseline checks syntax only; implementation must add meaningful tests before verification can pass.");
      }
    }
    return { checks, browser: false, notes };
  }
  throw new Error("Cannot detect project checks. Add ralph.config.json with checks and a browser boolean.");
}

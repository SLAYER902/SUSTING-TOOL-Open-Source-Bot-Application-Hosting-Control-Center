import { describe, expect, it } from "vitest";
import { runtimeFromFiles } from "../apps/web/lib/runtime";

describe("runtime detection", () => {
  it("prioritizes an explicit Dockerfile", () => expect(runtimeFromFiles(["package.json", "Dockerfile"])?.runtime).toBe("Docker"));
  it("detects Python manifests", () => expect(runtimeFromFiles(["src/main.py", "pyproject.toml"])?.runtime).toContain("Python"));
  it("returns null for unknown sources", () => expect(runtimeFromFiles(["notes.txt"])).toBeNull());
});

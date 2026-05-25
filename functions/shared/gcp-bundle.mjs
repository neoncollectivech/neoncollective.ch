import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const WORKSPACE_DIR = {
  "@neon/server-kit": "server-kit",
  "@neon/resource-api": "resource-api",
};

/** npm deps for deploy/package.json (function deps + workspace package deps, not workspace names). */
export function deployDeps(slug) {
  const fnPkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "functions", slug, "package.json"), "utf8"),
  );
  /** @type {Record<string, string>} */
  const deps = {};

  for (const [name, spec] of Object.entries(fnPkg.dependencies ?? {})) {
    const wsDir = WORKSPACE_DIR[name];
    if (wsDir) {
      const wsPkg = JSON.parse(
        fs.readFileSync(path.join(repoRoot, "packages", wsDir, "package.json"), "utf8"),
      );
      Object.assign(deps, wsPkg.dependencies ?? {});
    } else if (!name.startsWith("@neon/")) {
      deps[name] = spec;
    }
  }

  return deps;
}

/** Packages tsup must not bundle (function + workspace npm deps). */
export function tsupExternals(slug) {
  return Object.keys(deployDeps(slug));
}

export function gcpTsupOptions(slug) {
  return {
    entry: ["src/index.ts"],
    outDir: path.join(repoRoot, "deploy", slug, "dist"),
    format: ["esm"],
    platform: "node",
    target: "node22",
    bundle: true,
    splitting: false,
    sourcemap: false,
    minify: true,
    clean: true,
    dts: false,
    external: tsupExternals(slug),
    noExternal: [/^@neon\//],
    tsconfig: "tsconfig.json",
    outExtension: () => ({ js: ".js" }),
  };
}

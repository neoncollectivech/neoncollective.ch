#!/usr/bin/env node
/**
 * GCP Gen2 functions: bundle (tsup) and/or deploy (gcloud).
 *
 *   node scripts/gcp.mjs bundle <slug>       → deploy/<slug>/
 *   node scripts/gcp.mjs deploy <slug>       → bundle + gcloud
 *   node scripts/gcp.mjs deploy --all
 *
 * Needs functions/<slug>/env.yaml (copy from env.yaml.example).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deployDeps } from "../functions/shared/gcp-bundle.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const FN = {
  "stripe-api": {
    gcloudName: "neo-stripe-api",
    entryPoint: "stripeApi",
    memory: "256Mi",
    maxInstances: 2,
  },
  "events-api": {
    gcloudName: "neo-events-api",
    entryPoint: "eventsApi",
    memory: "512Mi",
    timeout: "120s",
    maxInstances: 2,
  },
};

const SLUGS = Object.keys(FN);

const [cmd, ...rest] = process.argv.slice(2);
const all = rest.includes("--all");
const slugs = all ? SLUGS : rest.filter((a) => !a.startsWith("--"));

if (!cmd || !["bundle", "deploy"].includes(cmd) || slugs.length === 0 || slugs.some((s) => !FN[s])) {
  console.error(`Usage: node scripts/gcp.mjs <bundle|deploy> <${SLUGS.join("|")}>|--all`);
  process.exit(1);
}

function run(command, args, opts = {}) {
  const r = spawnSync(command, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function workspaceFilters(fnDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(fnDir, "package.json"), "utf8"));
  return Object.entries(pkg.dependencies ?? {})
    .filter(([, spec]) => String(spec).startsWith("workspace:"))
    .map(([name]) => name);
}

function bundle(slug) {
  const fnDir = path.join(root, "functions", slug);
  const deployDir = path.join(root, "deploy", slug);

  fs.rmSync(deployDir, { recursive: true, force: true });

  const filters = workspaceFilters(fnDir);
  if (filters.length) {
    run("pnpm", [...filters.flatMap((f) => ["--filter", f]), "build"]);
  }

  run("pnpm", ["exec", "tsup"], { cwd: fnDir });

  const entry = path.join(deployDir, "dist", "index.js");
  if (!fs.existsSync(entry)) {
    console.error(`Missing ${entry}`);
    process.exit(1);
  }

  const srcPkg = JSON.parse(fs.readFileSync(path.join(fnDir, "package.json"), "utf8"));

  fs.writeFileSync(
    path.join(deployDir, "package.json"),
    JSON.stringify(
      {
        name: `${srcPkg.name}-gcp`,
        private: true,
        type: "module",
        main: "dist/index.js",
        dependencies: deployDeps(slug),
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(deployDir, ".npmrc"), "legacy-peer-deps=true\n");
  run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: deployDir });
}

function deploy(slug) {
  bundle(slug);

  const envFile = path.join(root, "functions", slug, "env.yaml");
  if (!fs.existsSync(envFile)) {
    console.error(`Missing ${envFile} — copy env.yaml.example first.`);
    process.exit(1);
  }

  const cfg = FN[slug];
  const args = [
    "functions",
    "deploy",
    cfg.gcloudName,
    "--gen2",
    "--runtime=nodejs22",
    "--region=europe-west6",
    "--project=neo-tickets-shop",
    `--source=${path.join(root, "deploy", slug)}`,
    `--entry-point=${cfg.entryPoint}`,
    "--trigger-http",
    "--allow-unauthenticated",
    `--env-vars-file=${envFile}`,
    `--memory=${cfg.memory}`,
    `--max-instances=${cfg.maxInstances}`,
  ];
  if (cfg.timeout) args.push(`--timeout=${cfg.timeout}`);

  run("gcloud", args);
}

for (const slug of slugs) {
  if (cmd === "bundle") bundle(slug);
  else deploy(slug);
}

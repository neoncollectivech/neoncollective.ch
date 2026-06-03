/**
 * GitHub Pages has no SPA fallback for /admin/* or /door/*. Prepend redirect scripts
 * to the Next.js-exported root 404.html so deep links load each SPA index first.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notFoundHtml = path.join(repoRoot, "apps/web/out/404.html");

const adminRedirectScript = `<script>
(function () {
  var p = location.pathname;
  if (p === "/admin" || p.startsWith("/admin/")) {
    if (!p.endsWith("/index.html")) {
      sessionStorage.setItem("adminSpaRedirect", location.href);
      location.replace(location.origin + "/admin/index.html");
    }
  }
})();
</script>`;

const doorRedirectScript = `<script>
(function () {
  var p = location.pathname;
  if (p === "/door" || p.startsWith("/door/")) {
    if (!p.endsWith("/index.html")) {
      sessionStorage.setItem("doorSpaRedirect", location.href);
      location.replace(location.origin + "/door/index.html");
    }
  }
})();
</script>`;

let html = readFileSync(notFoundHtml, "utf8");
let changed = false;

if (!html.includes("adminSpaRedirect")) {
  if (!/<head[^>]*>/i.test(html)) {
    console.error("patch-github-pages-admin-404: expected <head> in", notFoundHtml);
    process.exit(1);
  }

  html = html.replace(/<head([^>]*)>/i, `<head$1>${adminRedirectScript}`);
  changed = true;
}

if (!html.includes("doorSpaRedirect")) {
  if (!/<head[^>]*>/i.test(html)) {
    console.error("patch-github-pages-admin-404: expected <head> in", notFoundHtml);
    process.exit(1);
  }

  html = html.replace(/<head([^>]*)>/i, `<head$1>${doorRedirectScript}`);
  changed = true;
}

if (changed) {
  writeFileSync(notFoundHtml, html);
  console.log("Patched", notFoundHtml, "for /admin and /door SPA deep links");
}

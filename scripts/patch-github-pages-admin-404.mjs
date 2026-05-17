/**
 * GitHub Pages has no SPA fallback for /admin/*. Prepend a redirect script to the
 * Next.js-exported root 404.html so deep admin links load /admin/index.html first.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notFoundHtml = path.join(repoRoot, "apps/web/out/404.html");

const redirectScript = `<script>
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

let html = readFileSync(notFoundHtml, "utf8");
if (html.includes("adminSpaRedirect")) {
  process.exit(0);
}

if (!/<head[^>]*>/i.test(html)) {
  console.error("patch-github-pages-admin-404: expected <head> in", notFoundHtml);
  process.exit(1);
}

html = html.replace(/<head([^>]*)>/i, `<head$1>${redirectScript}`);
writeFileSync(notFoundHtml, html);
console.log("Patched", notFoundHtml, "for /admin SPA deep links");

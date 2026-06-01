/**
 * GitHub Pages serves 404.html for unknown paths. Root 404.html stashes the
 * intended URL and sends the browser to /admin/index.html; restore it before
 * React Router boots. Mirrors public/gh-pages-spa-fallback.js.
 */
const redirect = sessionStorage.getItem("adminSpaRedirect");

if (redirect) {
  sessionStorage.removeItem("adminSpaRedirect");
  history.replaceState(null, "", redirect);
}

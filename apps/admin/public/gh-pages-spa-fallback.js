/**
 * GitHub Pages serves 404.html for unknown paths. Root 404.html stashes the
 * intended URL and sends the browser to /admin/index.html; this script restores
 * it before React Router boots.
 */
(function () {
  var redirect = sessionStorage.getItem("adminSpaRedirect");
  if (!redirect) return;
  sessionStorage.removeItem("adminSpaRedirect");
  history.replaceState(null, "", redirect);
})();

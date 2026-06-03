/**
 * GitHub Pages serves 404.html for unknown paths. Root 404.html stashes the
 * intended URL and sends the browser to /door/index.html; restore before Router.
 */
(function () {
  var redirect = sessionStorage.getItem("doorSpaRedirect");
  if (!redirect) return;
  sessionStorage.removeItem("doorSpaRedirect");
  history.replaceState(null, "", redirect);
})();

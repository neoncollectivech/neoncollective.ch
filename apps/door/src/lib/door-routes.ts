/** Strip optional Vite base prefix so route checks work after hard reloads. */
export function doorRoutePath(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  if (!base || base === "/") {
    return pathname || "/";
  }

  if (pathname === base || pathname === `${base}/`) {
    return "/";
  }

  if (pathname.startsWith(`${base}/`)) {
    return pathname.slice(base.length) || "/";
  }

  return pathname || "/";
}

export function isDoorAuthenticatedRoute(pathname: string): boolean {
  const path = doorRoutePath(pathname);

  if (path === "/" || path === "") {
    return true;
  }

  return path.startsWith("/pos") || path.startsWith("/queue");
}

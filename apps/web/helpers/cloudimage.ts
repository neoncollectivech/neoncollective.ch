import urlJoin from "url-join";

const breakpoints = [640, 768, 1024, 1280, 1536];

const baseUrl = "https://chyxanezva.cloudimg.io/neoncollective.ch";

export function cloudimage(src: string, operations = {}) {
  const url = urlJoin(baseUrl, src);
  const urlParams = new URLSearchParams(operations);

  return `${url}?${urlParams.toString()}`;
}

export function getSrcSet(src: string): string {
  const imgSets = breakpoints.map(
    (bp) => `${cloudimage(src, { width: bp })} ${bp}w`,
  );

  return imgSets.join(",");
}

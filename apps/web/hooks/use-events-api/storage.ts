const checkoutOrderStoragePrefix = "neon:checkout-order:";

export function stashCheckoutOrderId(slug: string, orderId: string): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(`${checkoutOrderStoragePrefix}${slug}`, orderId);
}

export function takeCheckoutOrderId(slug: string): string | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  const key = `${checkoutOrderStoragePrefix}${slug}`;
  const orderId = sessionStorage.getItem(key);

  sessionStorage.removeItem(key);

  return orderId;
}

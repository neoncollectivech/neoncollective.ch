const IOS_INSTALL_DISMISS_KEY = "neon:door:iosInstallDismissed";

/** Already running as installed home-screen app. */
export function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function isIosDevice(): boolean {
  if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) {
    return true;
  }

  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** Safari on iOS (not Chrome/Firefox on iOS). */
export function isIosSafariBrowser(): boolean {
  if (!isIosDevice() || isStandaloneDisplay()) {
    return false;
  }

  const ua = navigator.userAgent;

  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function shouldShowIosInstallHint(): boolean {
  if (!isIosSafariBrowser()) {
    return false;
  }

  return localStorage.getItem(IOS_INSTALL_DISMISS_KEY) !== "1";
}

export function dismissIosInstallHint(): void {
  localStorage.setItem(IOS_INSTALL_DISMISS_KEY, "1");
}

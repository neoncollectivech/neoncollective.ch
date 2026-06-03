import { registerSW } from "virtual:pwa-register";

export type PwaUpdateState = {
  needRefresh: boolean;
  offlineReady: boolean;
  checking: boolean;
};

type PwaUpdateListener = (state: PwaUpdateState) => void;

let needRefresh = false;
let offlineReady = false;
let checking = false;

const listeners = new Set<PwaUpdateListener>();

function getState(): PwaUpdateState {
  return { needRefresh, offlineReady, checking };
}

function emit(): void {
  const state = getState();

  for (const listener of listeners) {
    listener(state);
  }
}

function setChecking(next: boolean): void {
  checking = next;
  emit();
}

const applyUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    needRefresh = true;
    emit();
  },
  onOfflineReady() {
    offlineReady = true;
    emit();
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }

    const check = () => {
      void registration.update().catch(() => {});
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        check();
      }
    });

    window.setInterval(check, 60 * 60 * 1000);
  },
});

export function subscribePwaUpdate(listener: PwaUpdateListener): () => void {
  listeners.add(listener);
  listener(getState());

  return () => {
    listeners.delete(listener);
  };
}

export function getPwaUpdateState(): PwaUpdateState {
  return getState();
}

export async function checkForPwaUpdate(): Promise<
  "available" | "current" | "unsupported"
> {
  if (!("serviceWorker" in navigator)) {
    return "unsupported";
  }

  setChecking(true);

  try {
    const registration = await navigator.serviceWorker.getRegistration();

    if (!registration) {
      return "current";
    }

    await registration.update();

    await new Promise((resolve) => window.setTimeout(resolve, 400));

    return needRefresh ? "available" : "current";
  } finally {
    setChecking(false);
  }
}

export function reloadForPwaUpdate(): void {
  void applyUpdate(true);
}

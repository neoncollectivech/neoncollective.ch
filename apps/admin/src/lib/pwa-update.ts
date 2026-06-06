import { registerSW } from "virtual:pwa-register";

export type PwaUpdateState = {
  needRefresh: boolean;
  offlineReady: boolean;
  checking: boolean;
};

let needRefresh = false;
let offlineReady = false;
let checking = false;

/** Stable reference between store updates — required for useSyncExternalStore. */
let snapshot: PwaUpdateState = {
  needRefresh: false,
  offlineReady: false,
  checking: false,
};

const listeners = new Set<() => void>();

function syncSnapshot(): void {
  if (
    snapshot.needRefresh === needRefresh &&
    snapshot.offlineReady === offlineReady &&
    snapshot.checking === checking
  ) {
    return;
  }

  snapshot = { needRefresh, offlineReady, checking };
}

function emit(): void {
  syncSnapshot();

  for (const listener of listeners) {
    listener();
  }
}

function setChecking(next: boolean): void {
  checking = next;
  emit();
}

type ApplyUpdateFn = (reloadPage?: boolean) => Promise<void>;

const noopApplyUpdate: ApplyUpdateFn = async () => {};

let applyUpdate: ApplyUpdateFn = noopApplyUpdate;

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  applyUpdate = registerSW({
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
}

/** useSyncExternalStore subscribe — notify with no args; read via getPwaUpdateState. */
export function subscribePwaUpdate(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getPwaUpdateState(): PwaUpdateState {
  return snapshot;
}

export async function checkForPwaUpdate(): Promise<
  "available" | "current" | "unsupported"
> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
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

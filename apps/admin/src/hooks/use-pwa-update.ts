import { useSyncExternalStore } from "react";

import {
  checkForPwaUpdate,
  getPwaUpdateState,
  reloadForPwaUpdate,
  subscribePwaUpdate,
} from "@/lib/pwa-update";

export function usePwaUpdate() {
  const state = useSyncExternalStore(subscribePwaUpdate, getPwaUpdateState);

  return {
    ...state,
    checkForUpdate: checkForPwaUpdate,
    applyUpdate: reloadForPwaUpdate,
  };
}

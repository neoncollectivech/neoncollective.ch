import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { usePwaUpdate } from "@/hooks/use-pwa-update";
import { reloadForPwaUpdate } from "@/lib/pwa-update";

const UPDATE_TOAST_ID = "admin-pwa-update";

export function PwaUpdateNotifier() {
  const { needRefresh } = usePwaUpdate();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!needRefresh) {
      shownRef.current = false;

      return;
    }

    if (shownRef.current) {
      return;
    }

    shownRef.current = true;

    toast.info("A new version of NEON Admin is ready.", {
      id: UPDATE_TOAST_ID,
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: "Update now",
        onClick: () => reloadForPwaUpdate(),
      },
    });
  }, [needRefresh]);

  return null;
}

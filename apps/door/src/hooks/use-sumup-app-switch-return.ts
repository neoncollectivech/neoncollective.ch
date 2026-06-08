import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { confirmPosAppSwitchSale, fetchPosSaleStatus } from "@/lib/pos-api";
import { getDoorSessionConfig } from "@/lib/storage/session-config";
import {
  PENDING_APP_SWITCH_HANDOFF_KEY,
  PENDING_APP_SWITCH_ORDER_KEY,
} from "@/lib/sumup-app-switch";

export type SumUpAppSwitchReturnState =
  | { kind: "idle" }
  | { kind: "no_session" }
  | {
      kind: "resume_payment";
      orderId: string;
      handoffUrl: string | null;
      amountCents: number;
      currency: string;
    }
  | {
      kind: "paid";
      guestName: string | null;
      tiers: string | null;
    };

function parseReturnParams(searchParams: URLSearchParams): {
  orderId: string;
  smpStatus: string | null;
  transactionCode: string | null;
} | null {
  if (searchParams.get("sumup") !== "return") {
    return null;
  }

  const orderId = searchParams.get("orderId")?.trim();

  if (!orderId) {
    return null;
  }

  return {
    orderId,
    smpStatus: searchParams.get("smp-status"),
    transactionCode: searchParams.get("smp-tx-code"),
  };
}

export function useSumUpAppSwitchReturn(): SumUpAppSwitchReturnState {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<SumUpAppSwitchReturnState>({
    kind: "idle",
  });
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const params = parseReturnParams(searchParams);
    const pendingOrderId = sessionStorage.getItem(PENDING_APP_SWITCH_ORDER_KEY);
    const pendingHandoffUrl = sessionStorage.getItem(
      PENDING_APP_SWITCH_HANDOFF_KEY,
    );
    const session = getDoorSessionConfig();

    if (!params) {
      if (
        pendingOrderId &&
        session &&
        handledRef.current !== `pending:${pendingOrderId}`
      ) {
        handledRef.current = `pending:${pendingOrderId}`;
        void fetchPosSaleStatus(pendingOrderId).then((status) => {
          if (
            status.status === "paid" ||
            status.paymentStatus === "successful"
          ) {
            sessionStorage.removeItem(PENDING_APP_SWITCH_ORDER_KEY);
            sessionStorage.removeItem(PENDING_APP_SWITCH_HANDOFF_KEY);
            setState({
              kind: "paid",
              guestName: status.guestName,
              tiers: status.tiers,
            });

            return;
          }
          setState({
            kind: "resume_payment",
            orderId: pendingOrderId,
            handoffUrl: pendingHandoffUrl,
            amountCents: status.amountCents,
            currency: "CHF",
          });
        });
      }

      return;
    }

    const handleKey = `return:${params.orderId}:${params.smpStatus ?? ""}:${params.transactionCode ?? ""}`;

    if (handledRef.current === handleKey) {
      return;
    }
    handledRef.current = handleKey;

    const next = new URLSearchParams(searchParams);

    next.delete("sumup");
    next.delete("orderId");
    next.delete("smp-status");
    next.delete("smp-tx-code");
    next.delete("foreign-tx-id");
    setSearchParams(next, { replace: true });

    if (!session) {
      setState({ kind: "no_session" });

      return;
    }

    void (async () => {
      const smpStatus =
        params.smpStatus === "success" ||
        params.smpStatus === "failed" ||
        params.smpStatus === "invalidstate"
          ? params.smpStatus
          : undefined;

      try {
        await confirmPosAppSwitchSale(params.orderId, {
          smpStatus,
          transactionCode: params.transactionCode ?? undefined,
        });
      } catch {
        /* poll may still succeed */
      }

      const status = await fetchPosSaleStatus(params.orderId);

      if (status.status === "paid" || status.paymentStatus === "successful") {
        sessionStorage.removeItem(PENDING_APP_SWITCH_ORDER_KEY);
        sessionStorage.removeItem(PENDING_APP_SWITCH_HANDOFF_KEY);
        setState({
          kind: "paid",
          guestName: status.guestName,
          tiers: status.tiers,
        });

        return;
      }

      setState({
        kind: "resume_payment",
        orderId: params.orderId,
        handoffUrl: pendingHandoffUrl,
        amountCents: status.amountCents,
        currency: "CHF",
      });
    })();
  }, [searchParams, setSearchParams]);

  return state;
}

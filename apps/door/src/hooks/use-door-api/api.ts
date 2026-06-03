import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { postCheckIn } from "@/lib/door-api";
import { countPendingOutbox } from "@/lib/storage/check-in-outbox";

import { doorKeys } from "./keys";

export const doorApi = {
  keys: doorKeys,
  checkIn: {
    submit: () =>
      mutationOptions({
        mutationKey: doorKeys.checkIn.all(),
        mutationFn: (token: string) => postCheckIn(token),
      }),
  },
  outbox: {
    stats: () =>
      queryOptions({
        queryKey: doorKeys.outbox.stats(),
        queryFn: countPendingOutbox,
        refetchInterval: (query) => {
          const pending = query.state.data ?? 0;

          return pending > 0 ? 5_000 : false;
        },
      }),
  },
};

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  cancelPosSale,
  createPosSale,
  fetchPosCatalog,
  fetchPosSaleStatus,
  listPosReaders,
  previewPosPricing,
  resolvePosGuest,
} from "@/lib/pos-api";

import { posKeys } from "./keys";

export const posApi = {
  keys: posKeys,
  readers: {
    list: () =>
      queryOptions({
        queryKey: posKeys.readers(),
        queryFn: listPosReaders,
        staleTime: 60_000,
      }),
  },
  catalog: {
    detail: () =>
      queryOptions({
        queryKey: posKeys.catalog(),
        queryFn: fetchPosCatalog,
        staleTime: 30_000,
      }),
  },
  guest: {
    resolve: () =>
      mutationOptions({
        mutationKey: [...posKeys.all, "guest-resolve"],
        mutationFn: resolvePosGuest,
      }),
  },
  pricing: {
    preview: (params: { exclusiveTierId: string; addonTierIds: string[] }) =>
      queryOptions({
        queryKey: posKeys.pricing(params),
        queryFn: () => previewPosPricing(params),
        enabled:
          Boolean(params.exclusiveTierId) || params.addonTierIds.length > 0,
      }),
  },
  sale: {
    create: () =>
      mutationOptions({
        mutationKey: [...posKeys.all, "sale-create"],
        mutationFn: createPosSale,
      }),
    cancel: () =>
      mutationOptions({
        mutationKey: [...posKeys.all, "sale-cancel"],
        mutationFn: (orderId: string) => cancelPosSale(orderId),
      }),
    status: (orderId: string) =>
      queryOptions({
        queryKey: posKeys.sale(orderId),
        queryFn: () => fetchPosSaleStatus(orderId),
        enabled: Boolean(orderId),
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          const paymentStatus = query.state.data?.paymentStatus;

          if (status === "paid" || status === "failed") {
            return false;
          }
          if (paymentStatus === "successful" || paymentStatus === "failed") {
            return false;
          }

          return 2_000;
        },
      }),
  },
};

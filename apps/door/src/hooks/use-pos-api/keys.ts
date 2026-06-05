export const posKeys = {
  all: ["pos"] as const,
  readers: () => [...posKeys.all, "readers"] as const,
  catalog: () => [...posKeys.all, "catalog"] as const,
  pricing: (params: { exclusiveTierId: string; addonTierIds: string[] }) =>
    [
      ...posKeys.all,
      "pricing",
      params.exclusiveTierId,
      [...params.addonTierIds].sort().join(","),
    ] as const,
  sale: (orderId: string) => [...posKeys.all, "sale", orderId] as const,
};

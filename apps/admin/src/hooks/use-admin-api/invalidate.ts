"use client";

import { useQueryClient } from "@tanstack/react-query";

import { adminKeys } from "./keys";

export function useAdminInvalidate() {
  const queryClient = useQueryClient();

  return {
    events: async (eventId?: string) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.events.all });
      await queryClient.invalidateQueries({
        queryKey: adminKeys.eventInvitees.all,
      });
      if (eventId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.events.detail(eventId),
        });
      }
    },
    orders: async (orderId?: string) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.orders.all });
      if (orderId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.orders.detail(orderId),
        });
      }
    },
    people: async (personId?: string) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.people.all });
      if (personId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.people.detail(personId),
        });
      }
    },
  };
}

/** @deprecated Use useAdminInvalidate */
export const useAdminApiInvalidate = useAdminInvalidate;

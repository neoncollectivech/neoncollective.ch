import { useParams } from "react-router-dom";

import { isUuid } from "@/lib/uuid";

export function useEventIdParam() {
  const { eventId: raw } = useParams();
  const eventId = isUuid(raw ?? "") ? raw! : "";

  return { eventId, isValid: Boolean(eventId) };
}

export function useOrderIdParam() {
  const { orderId: raw } = useParams();
  const orderId = isUuid(raw ?? "") ? raw! : "";

  return { orderId, isValid: Boolean(orderId) };
}

export function useAdmissionIdParam() {
  const { admissionId: raw } = useParams();
  const admissionId = isUuid(raw ?? "") ? raw! : "";

  return { admissionId, isValid: Boolean(admissionId) };
}

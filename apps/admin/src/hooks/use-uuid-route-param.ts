import { useParams } from "react-router-dom";

import { isUuid } from "@/lib/uuid";

export function useUuidRouteParam(paramName = "id") {
  const params = useParams();
  const raw = params[paramName] ?? "";
  const id = isUuid(raw) ? raw : "";

  return { id, isValid: Boolean(id) };
}

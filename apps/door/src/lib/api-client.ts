import axios from "axios";

import { getDoorSessionConfig } from "@/lib/storage/session-config";

const baseURL = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_EVENTS_API_URL?.trim() ?? "");

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const session = getDoorSessionConfig();

  if (session?.apiKey) {
    config.headers.Authorization = `Bearer ${session.apiKey}`;
  }

  return config;
});

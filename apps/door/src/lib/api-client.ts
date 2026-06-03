import axios from "axios";

import {
  getDoorApiKeyConfig,
  getDoorSessionConfig,
} from "@/lib/storage/session-config";

const baseURL = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_EVENTS_API_URL?.trim() ?? "");

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const apiKey =
    getDoorSessionConfig()?.apiKey ?? getDoorApiKeyConfig()?.apiKey;

  if (apiKey) {
    config.headers.Authorization = `Bearer ${apiKey}`;
  }

  return config;
});

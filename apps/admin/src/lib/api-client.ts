import axios from "axios";

const baseURL = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_EVENTS_API_URL?.trim() ?? "");

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

export type ListMeta = {
  total: number;
  limit: number;
  skip: number;
};

export type ListResponse<T> = {
  items: T[];
  meta: ListMeta;
};

export type ItemResponse<T> = {
  item: T;
};

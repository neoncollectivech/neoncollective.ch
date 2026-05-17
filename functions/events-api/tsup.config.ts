import { defineConfig } from "tsup";

import { gcpTsupOptions } from "../shared/gcp-bundle.mjs";

export default defineConfig(gcpTsupOptions("events-api"));

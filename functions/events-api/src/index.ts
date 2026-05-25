import * as functions from "@google-cloud/functions-framework";
import { getRequestListener } from "@hono/node-server";

import app from "./app";

functions.http("eventsApi", getRequestListener(app.fetch));

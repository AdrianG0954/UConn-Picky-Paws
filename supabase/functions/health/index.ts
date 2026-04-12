import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  errorResponse,
  handleOptions,
  jsonResponse,
  toHttpError,
} from "../_shared/http.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse(405, "Method not allowed.");
  }

  try {
    return jsonResponse({ status: "ok" });
  } catch (error) {
    const httpError = toHttpError(error);
    return errorResponse(httpError.status, httpError.message, httpError.detail);
  }
});

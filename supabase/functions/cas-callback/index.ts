import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createAccessToken,
  validateCasTicket,
} from "../_shared/auth.ts";
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

  if (req.method !== "GET") {
    return errorResponse(405, "Method not allowed.");
  }

  try {
    const url = new URL(req.url);
    const ticket = url.searchParams.get("ticket")?.trim();
    if (!ticket) {
      return errorResponse(400, "Missing sign-in ticket.");
    }

    const identity = await validateCasTicket(ticket);
    return jsonResponse(await createAccessToken(identity));
  } catch (error) {
    const httpError = toHttpError(error);
    return errorResponse(httpError.status, httpError.message, httpError.detail);
  }
});

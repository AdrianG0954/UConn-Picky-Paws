import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  errorResponse,
  handleOptions,
  jsonResponse,
  toHttpError,
} from "../_shared/http.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse(405, "Method not allowed.");
  }

  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("dining_halls")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return jsonResponse(data ?? []);
  } catch (error) {
    const httpError = toHttpError(error);
    return errorResponse(httpError.status, httpError.message, httpError.detail);
  }
});

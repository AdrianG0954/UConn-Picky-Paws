import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  HttpError,
  errorResponse,
  handleOptions,
  jsonResponse,
  readJson,
  toHttpError,
} from "../_shared/http.ts";
import { requireAuthenticatedRequest } from "../_shared/auth.ts";
import { getDiningHallInfo, parseFoodItems } from "../_shared/dining-halls.ts";

type MenuRequest = {
  hallName: string;
  dtdate?: string | null;
};

// TODO: Integrate with availability
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed.");
  }

  try {
    await requireAuthenticatedRequest(req);
    const body = await readJson<MenuRequest>(req);
    if (!body.hallName) {
      throw new HttpError(400, "hallName is required.");
    }

    const hall = getDiningHallInfo(body.hallName);
    const params = new URLSearchParams({
      sName: "UCONN Dining Services",
      locationNum: hall.locationNum,
      locationName: hall.hallName,
      naFlag: "1",
      myaction: "read",
    });

    if (body.dtdate) {
      params.set("dtdate", body.dtdate);
    }

    try {
      const response = await fetch(
        `https://nutritionanalysis.dds.uconn.edu/shortmenu.aspx?${params.toString()}`,
      );

      if (!response.ok) {
        return jsonResponse({ dishes: {} });
      }

      const html = await response.text();
      return jsonResponse({ dishes: parseFoodItems(html) });
    } catch {
      return jsonResponse({ dishes: {} });
    }
  } catch (error) {
    const httpError = toHttpError(error);
    return errorResponse(httpError.status, httpError.message, httpError.detail);
  }
});

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

export class HttpError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.detail = detail ?? message;
  }
}

function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  headers.set("Content-Type", "application/json");
  return headers;
}

export function handleOptions(req: Request): Response | null {
  if (req.method !== "OPTIONS") {
    return null;
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: buildHeaders(init.headers),
  });
}

export function errorResponse(
  status: number,
  message: string,
  detail?: unknown,
): Response {
  return jsonResponse({ detail: detail ?? message }, { status });
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof Error) {
    return new HttpError(500, error.message);
  }

  return new HttpError(500, "Unexpected server error.");
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

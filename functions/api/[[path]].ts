// Cloudflare Pages Function: Proxy /api/* requests to the Worker
// Supports SSE streaming by passing the response body through directly.
const API_ORIGIN = "https://gaigentic-hub-api.krishnagaigenticai.workers.dev";

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const apiPath = url.pathname.replace(/^\/api/, "");
  const target = `${API_ORIGIN}${apiPath}${url.search}`;

  // Clone headers and add forwarded IP
  const headers = new Headers(context.request.headers);
  headers.set("X-Forwarded-For", context.request.headers.get("cf-connecting-ip") || "");
  // Remove host header so the Worker receives its own host
  headers.delete("host");

  const init: RequestInit = {
    method: context.request.method,
    headers,
  };

  // Forward body for non-GET requests
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
    // @ts-expect-error — duplex required for streaming request bodies in newer runtimes
    init.duplex = "half";
  }

  const response = await fetch(target, init);

  // Build clean response headers
  const resHeaders = new Headers(response.headers);
  resHeaders.delete("X-Powered-By");

  // Return the response with its body stream intact
  // The body ReadableStream passes through directly to the client
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders,
  });
};

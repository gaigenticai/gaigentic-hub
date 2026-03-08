// Cloudflare Pages Function: Proxy /api/* requests to the Worker
const API_ORIGIN = "https://gaigentic-hub-api.krishnagaigenticai.workers.dev";

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const apiPath = url.pathname.replace(/^\/api/, "");
  const target = `${API_ORIGIN}${apiPath}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.set("X-Forwarded-For", context.request.headers.get("cf-connecting-ip") || "");

  const response = await fetch(target, {
    method: context.request.method,
    headers,
    body: context.request.method !== "GET" ? context.request.body : undefined,
  });

  // For SSE streams, pass through the body directly with correct headers
  const resHeaders = new Headers(response.headers);
  resHeaders.delete("X-Powered-By");
  resHeaders.set("Server", "GaiGentic Hub");

  const isSSE = response.headers.get("content-type")?.includes("text/event-stream");
  if (isSSE) {
    resHeaders.set("Cache-Control", "no-cache");
    resHeaders.set("Connection", "keep-alive");
    resHeaders.delete("content-encoding");
    resHeaders.delete("content-length");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders,
  });
};

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

  const res = new Response(response.body, response);
  res.headers.delete("X-Powered-By");
  res.headers.set("Server", "GaiGentic Hub");
  return res;
};

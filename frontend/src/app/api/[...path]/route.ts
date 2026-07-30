const API_ORIGIN = "https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api";

export const dynamic = "force-dynamic";

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = `${API_ORIGIN}/${path.map((part) => encodeURIComponent(part)).join("/")}${new URL(request.url).search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("origin");
  headers.delete("content-length");

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!key.toLowerCase().startsWith("set-cookie") && key.toLowerCase() !== "content-length" && key.toLowerCase() !== "content-encoding") {
      responseHeaders.set(key, value);
    }
  });
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  for (const cookie of getSetCookie ? getSetCookie.call(upstream.headers) : []) responseHeaders.append("set-cookie", cookie);

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;

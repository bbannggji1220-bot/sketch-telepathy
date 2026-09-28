// 스케치 텔레파시용 Gemini 중계 서버.
// API 키는 Cloudflare 비밀값(GEMINI_API_KEY)에만 있고, 브라우저와 저장소에는 노출되지 않습니다.
const MODELS = ["gemini-3.5-flash-lite", "gemini-3-flash-preview"];
const MAX_BODY_BYTES = 2_000_000;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim());
    if (!allowed.includes(origin)) return new Response("Forbidden", { status: 403 });

    const cors = corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });
    if (!env.GEMINI_API_KEY) return new Response("Server key not configured", { status: 500, headers: cors });

    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413, headers: cors });

    let upstream;
    for (const model of MODELS) {
      upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body,
      });
      // 모델이 없거나 폐기된 경우(404)에만 다음 모델로 재시도
      if (upstream.status !== 404) break;
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};

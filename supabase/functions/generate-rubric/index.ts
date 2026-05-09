// Supabase Edge Function: generate-rubric
// Mentor-only. Given an assignment title + description, returns 5–7 weighted
// rubric criteria as JSON.
//
// Body:    { title: string, description: string, count?: number }
// Returns: { rubric: [{ criterion: string, weight: number }] }
//
// Deploy:  supabase functions deploy generate-rubric
// Secrets: GEMINI_API_KEY (already set)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function buildPrompt(title: string, description: string, count: number) {
  return `You design grading rubrics for student coding assignments.

ASSIGNMENT TITLE: ${title}
DESCRIPTION:
${description}

Produce a rubric of exactly ${count} criteria that a senior reviewer would use
to score a submitted GitHub repo for this assignment. Each criterion should be:
- Concrete and observable in the code (not vague aspirations)
- Specific to this assignment (not generic platitudes like "Good code")
- Weighted by importance — weights MUST be positive integers summing to exactly 100

Return STRICT JSON (no prose) in this shape:
{
  "rubric": [
    { "criterion": "<short observable rule>", "weight": <int> }
  ]
}

Examples of good criteria:
- "Implements all endpoints listed in the spec (GET, POST, PATCH, DELETE)"
- "Includes a README with setup steps and a usage example"
- "Has at least one passing test for the happy path"
Examples of bad criteria:
- "Code quality"  (too vague)
- "Effort"        (subjective, unobservable)`;
}

async function callGemini(prompt: string, apiKey: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${text.slice(0, 500)}`);
  }
  const j = await res.json();
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return JSON.parse(text);
}

// Coerce weights to positive integers summing to exactly 100.
function normalizeWeights(rubric: any[]): { criterion: string; weight: number }[] {
  if (!Array.isArray(rubric) || rubric.length === 0) return [];
  const items = rubric
    .map((r) => ({
      criterion: String(r?.criterion ?? "").trim(),
      weight: Math.max(0, Math.round(Number(r?.weight) || 0)),
    }))
    .filter((r) => r.criterion);
  if (items.length === 0) return [];
  const total = items.reduce((s, r) => s + r.weight, 0);
  if (total === 100) return items;
  if (total === 0) {
    const each = Math.floor(100 / items.length);
    items.forEach((r, i) => { r.weight = each + (i === items.length - 1 ? 100 - each * items.length : 0); });
    return items;
  }
  // Scale to sum 100, then fix rounding drift on the last item.
  const scaled = items.map((r) => ({ ...r, weight: Math.round((r.weight / total) * 100) }));
  const drift = 100 - scaled.reduce((s, r) => s + r.weight, 0);
  scaled[scaled.length - 1].weight += drift;
  return scaled;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return json({ error: "Unauthenticated" }, 401);
  const { data: profile } = await userClient
    .from("users").select("role").eq("id", userRes.user.id).single();
  if (profile?.role !== "mentor") return json({ error: "Mentor role required" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const count = Math.max(3, Math.min(10, Number(body.count) || 6));
  if (!title) return json({ error: "title required" }, 400);
  if (!description) return json({ error: "description required" }, 400);

  try {
    const result = await callGemini(buildPrompt(title, description, count), GEMINI_KEY);
    const rubric = normalizeWeights(result?.rubric);
    if (rubric.length === 0) {
      return json({ error: "Gemini returned an empty or invalid rubric" }, 502);
    }
    return json({ rubric });
  } catch (err) {
    return json({ error: (err as Error).message || String(err) }, 500);
  }
});

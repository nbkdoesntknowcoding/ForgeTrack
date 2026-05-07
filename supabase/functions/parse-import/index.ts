// Supabase Edge Function: parse-import
// Mentor-only. Inspects spreadsheet headers + sample rows and returns a
// structured column mapping (kind per column, layout, attendance convention).
//
// Body:    { headers: string[], sample_rows: any[][] }
// Returns: { is_pivoted, date_format, attendance_convention, columns: [...] }
//
// Deploy:  supabase functions deploy parse-import
// Secrets: GEMINI_API_KEY (already set for analyze-submission)

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

const ALLOWED_KINDS = [
  "ignore",
  "student_name",
  "usn",
  "email",
  "branch_code",
  "admission_number",
  "batch",
  "date",
  "attendance_value",
];

function buildPrompt(headers: string[], sampleRows: any[][]) {
  const sampleBlock = sampleRows
    .slice(0, 8)
    .map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`)
    .join("\n");

  return `You are a data mapping assistant for an attendance/roster importer.
The target schema has these student fields: name, usn, email, branch_code, admission_number, batch.
The target schema has sessions identified by date (one session per date).
Attendance values are booleans (present/absent) per (student, session).

Below are the spreadsheet headers and sample rows. Decide the layout and map every column.

HEADERS: ${JSON.stringify(headers)}

SAMPLE ROWS:
${sampleBlock}

Return STRICT JSON in this exact shape:
{
  "is_pivoted": <boolean>,        // true if each row is a student and date columns hold attendance values; false if each row is a single (student, date) attendance entry
  "date_format": "<DD/M/YY|DD/MM/YYYY|MM/DD/YYYY|YYYY-MM-DD|other>",
  "attendance_convention": "<TRUE_FALSE|PA|PRESENT_ABSENT|10|YN|UNKNOWN>",
  "columns": [
    { "header": "<exact header text>", "kind": "<one of: ${ALLOWED_KINDS.join("|")}>", "iso_date": "<YYYY-MM-DD if kind==date>", "optional": <boolean> }
  ]
}

Rules:
- Every header in HEADERS must appear in columns exactly once.
- "kind":"ignore" for serial numbers, links, blank columns, totals, summary columns.
- For pivoted layouts, date column headers (often like "15/4/26", "8/4/26", "Apr 15") get kind="date" with iso_date set.
- For long layouts, the column holding present/absent values gets kind="attendance_value".
- Use "student_name" for the human name and "usn" for the unique student id (USN/roll number).
- Be tolerant of misspelled headers ("studnet name", "useer branch", etc.).
- If you cannot infer a column kind, default to "ignore".`;
}

async function callGemini(prompt: string, apiKey: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  // Mentor-only
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
  const headers: string[] = Array.isArray(body.headers) ? body.headers : [];
  const sampleRows: any[][] = Array.isArray(body.sample_rows) ? body.sample_rows : [];
  if (headers.length === 0) return json({ error: "headers[] required" }, 400);

  try {
    const result = await callGemini(buildPrompt(headers, sampleRows), GEMINI_KEY);

    // Defensive normalization: ensure every header is represented; default to ignore if missing.
    const byHeader = new Map<string, any>();
    (result.columns || []).forEach((c: any) => {
      if (typeof c?.header === "string") byHeader.set(c.header, c);
    });
    const columns = headers.map((h) => {
      const c = byHeader.get(h);
      const kind = ALLOWED_KINDS.includes(c?.kind) ? c.kind : "ignore";
      return {
        header: h,
        kind,
        iso_date: kind === "date" ? c?.iso_date ?? null : null,
        optional: !!c?.optional,
      };
    });

    return json({
      is_pivoted: !!result.is_pivoted,
      date_format: result.date_format || "UNKNOWN",
      attendance_convention: result.attendance_convention || "UNKNOWN",
      columns,
    });
  } catch (err) {
    return json({ error: (err as Error).message || String(err) }, 500);
  }
});

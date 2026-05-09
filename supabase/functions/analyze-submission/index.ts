// Supabase Edge Function: analyze-submission
// Mentor-triggered. Pulls a GitHub repo's README + tree + a few key files, asks
// Gemini to score it against the assignment's rubric, and stores the result in
// submission_analyses.
//
// Deploy:   supabase functions deploy analyze-submission
// Secrets:  supabase secrets set GEMINI_API_KEY=... [GITHUB_TOKEN=...]
// Invoke:   supabase.functions.invoke('analyze-submission', { body: { submission_id } })

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SOURCE_EXT_PRIORITY = [
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".java", ".rs",
  ".cpp", ".c", ".rb", ".php", ".kt", ".swift",
];
const SKIP_DIR_RE = /(^|\/)(node_modules|dist|build|\.next|\.git|vendor|target|__pycache__|venv|env)(\/|$)/;
const SKIP_FILE_RE = /\.(lock|min\.js|min\.css|map|png|jpg|jpeg|gif|svg|webp|ico|pdf|zip|gz|tar|woff2?|ttf|eot|mp4|mp3)$/i;
const ENTRY_HINTS = /\b(index|main|app|server|cli)\b/i;
const MAX_FILES = 8;
const MAX_FILE_BYTES = 8 * 1024;

interface RubricItem { criterion: string; weight: number; }

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (!/github\.com$/.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

async function gh(path: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ForgeTrack-Analyzer",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`https://api.github.com${path}`, { headers });
}

async function pickFiles(
  owner: string,
  repo: string,
  defaultBranch: string,
  token?: string,
): Promise<{ tree: string[]; files: { path: string; content: string }[] }> {
  const treeRes = await gh(`/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, token);
  if (!treeRes.ok) throw new Error(`GitHub tree fetch failed (${treeRes.status})`);
  const treeJson = await treeRes.json();

  const allBlobs: { path: string; size: number }[] = (treeJson.tree || [])
    .filter((n: any) => n.type === "blob" && !SKIP_DIR_RE.test(n.path) && !SKIP_FILE_RE.test(n.path));

  const tree = allBlobs.map((b) => b.path).slice(0, 200);

  const scored = allBlobs
    .map((b) => {
      const ext = "." + (b.path.split(".").pop() || "").toLowerCase();
      const extRank = SOURCE_EXT_PRIORITY.indexOf(ext);
      if (extRank === -1) return null;
      const depth = b.path.split("/").length;
      const isEntry = ENTRY_HINTS.test(b.path.split("/").pop() || "");
      // lower score = better
      const score = extRank + depth * 2 + (isEntry ? -10 : 0);
      return { ...b, score };
    })
    .filter((x): x is { path: string; size: number; score: number } => x !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_FILES);

  const files: { path: string; content: string }[] = [];
  for (const f of scored) {
    const r = await gh(`/repos/${owner}/${repo}/contents/${f.path}?ref=${defaultBranch}`, token);
    if (!r.ok) continue;
    const j = await r.json();
    if (j.encoding === "base64" && typeof j.content === "string") {
      const decoded = atob(j.content.replace(/\n/g, ""));
      files.push({ path: f.path, content: decoded.slice(0, MAX_FILE_BYTES) });
    }
  }
  return { tree, files };
}

function buildPrompt(args: {
  title: string;
  description: string | null;
  rubric: RubricItem[];
  readme: string;
  tree: string[];
  files: { path: string; content: string }[];
}): string {
  const rubricBlock = args.rubric
    .map((r, i) => `${i + 1}. "${r.criterion}" (max ${r.weight} points)`)
    .join("\n");

  const filesBlock = args.files
    .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
    .join("\n\n");

  return `You are a senior code reviewer evaluating a student's coding assignment.

ASSIGNMENT TITLE: ${args.title}
ASSIGNMENT DESCRIPTION:
${args.description || "(no description provided)"}

RUBRIC (score each item from 0 to its max; the sum of max points is the overall_score scale):
${rubricBlock}

REPOSITORY README:
${args.readme.slice(0, 6000) || "(no README found)"}

REPOSITORY FILE TREE (truncated):
${args.tree.slice(0, 100).join("\n")}

KEY SOURCE FILES (truncated):
${filesBlock}

Return STRICT JSON with this exact shape and no extra prose:
{
  "overall_score": <integer 0-100, normalized to /100>,
  "rubric_scores": [
    { "criterion": "<exact criterion text>", "score": <int>, "max": <int from rubric>, "comment": "<one sentence>" }
  ],
  "summary": "<2-3 sentence overall verdict>",
  "strengths": ["<short bullet>", ...],
  "weaknesses": ["<short bullet>", ...]
}`;
}

async function callGemini(prompt: string, apiKey: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
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
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return JSON.parse(text);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
  const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || undefined;

  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Authenticated client (uses caller's JWT) — used to verify caller is a mentor.
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) {
    return new Response(JSON.stringify({ error: "Unauthenticated" }),
      { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  const { data: profile } = await userClient
    .from("users").select("role, student_id").eq("id", userRes.user.id).single();
  if (profile?.role !== "mentor" && profile?.role !== "student") {
    return new Response(JSON.stringify({ error: "Mentor or student role required" }),
      { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Service-role client for writes that bypass RLS (we already authorized above).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  let submissionId: number;
  try {
    const body = await req.json();
    submissionId = Number(body.submission_id);
    if (!submissionId) throw new Error("submission_id required");
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Students can only analyze their own submission.
  if (profile.role === "student") {
    const { data: subOwner } = await admin
      .from("submissions").select("student_id").eq("id", submissionId).single();
    if (!subOwner || subOwner.student_id !== profile.student_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }
  }

  // Mark running.
  await admin.from("submission_analyses").upsert({
    submission_id: submissionId,
    status: "running",
    error_message: null,
    analyzed_by: userRes.user.id,
  }, { onConflict: "submission_id" });

  try {
    const { data: sub, error: subErr } = await admin
      .from("submissions")
      .select("id, github_url, assignment_id, assignments(title, description, rubric)")
      .eq("id", submissionId)
      .single();
    if (subErr || !sub) throw new Error("Submission not found");
    if (!sub.github_url) throw new Error("Submission has no GitHub URL");

    const parsed = parseRepoUrl(sub.github_url);
    if (!parsed) throw new Error("Invalid GitHub URL");

    const repoRes = await gh(`/repos/${parsed.owner}/${parsed.repo}`, GITHUB_TOKEN);
    if (!repoRes.ok) throw new Error(`Repo fetch failed (${repoRes.status})`);
    const repoMeta = await repoRes.json();
    const defaultBranch = repoMeta.default_branch || "main";

    const readmeRes = await gh(`/repos/${parsed.owner}/${parsed.repo}/readme`, GITHUB_TOKEN);
    let readme = "";
    if (readmeRes.ok) {
      const j = await readmeRes.json();
      if (j.encoding === "base64" && j.content) readme = atob(j.content.replace(/\n/g, ""));
    }

    const { tree, files } = await pickFiles(parsed.owner, parsed.repo, defaultBranch, GITHUB_TOKEN);

    const rubric = (sub.assignments?.rubric || []) as RubricItem[];
    if (!rubric.length) throw new Error("Assignment has no rubric");

    const prompt = buildPrompt({
      title: sub.assignments.title,
      description: sub.assignments.description,
      rubric,
      readme,
      tree,
      files,
    });

    const result = await callGemini(prompt, GEMINI_KEY);

    const { data: saved, error: saveErr } = await admin
      .from("submission_analyses")
      .upsert({
        submission_id: submissionId,
        status: "done",
        overall_score: result.overall_score ?? null,
        rubric_scores: result.rubric_scores ?? null,
        summary: result.summary ?? null,
        strengths: result.strengths ?? null,
        weaknesses: result.weaknesses ?? null,
        raw_response: result,
        error_message: null,
        analyzed_at: new Date().toISOString(),
        analyzed_by: userRes.user.id,
      }, { onConflict: "submission_id" })
      .select()
      .single();
    if (saveErr) throw saveErr;

    return new Response(JSON.stringify({ ok: true, analysis: saved }),
      { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    const message = (err as Error).message || "Unknown error";
    await admin.from("submission_analyses").upsert({
      submission_id: submissionId,
      status: "error",
      error_message: message,
      analyzed_at: new Date().toISOString(),
      analyzed_by: userRes.user.id,
    }, { onConflict: "submission_id" });
    return new Response(JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

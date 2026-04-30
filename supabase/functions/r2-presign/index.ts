// Supabase Edge Function: r2-presign
// Returns presigned R2 (S3-compatible) URLs.
//
// Modes:
//   - PUT: student/mentor uploads a file. Body { op: "put", assignment_id, filename, content_type }.
//          Server picks the key as `assignment-{id}/{user_id}/{ts}-{safe_filename}`.
//          Returns { url, key, expires_in }.
//   - GET: anyone with submission visibility downloads a file. Body { op: "get", key }.
//          Returns { url, expires_in }.
//
// Secrets:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//
// Deploy:
//   supabase functions deploy r2-presign

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PUT_TTL_SECS = 600;   // 10 min — upload window
const GET_TTL_SECS = 600;   // 10 min — download window
const MAX_BYTES = 25 * 1024 * 1024; // not enforced server-side without streaming; client-side check still required

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
  const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
  const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const R2_BUCKET = Deno.env.get("R2_BUCKET");

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    return json({ error: "R2 credentials not configured" }, 500);
  }

  // Authenticated caller (any signed-in user is allowed; per-key access is enforced via the
  // submissions RLS policies when the key is read/written into the table).
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return json({ error: "Unauthenticated" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const aws = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const baseUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;

  if (body.op === "put") {
    const assignmentId = Number(body.assignment_id);
    const filename = typeof body.filename === "string" ? body.filename : null;
    const contentType = typeof body.content_type === "string" ? body.content_type : "application/octet-stream";
    if (!assignmentId || !filename) return json({ error: "assignment_id and filename required" }, 400);

    const key = `assignment-${assignmentId}/${userRes.user.id}/${Date.now()}-${safeName(filename)}`;
    const url = `${baseUrl}/${key}?X-Amz-Expires=${PUT_TTL_SECS}`;

    const signed = await aws.sign(
      new Request(url, { method: "PUT", headers: { "Content-Type": contentType } }),
      { aws: { signQuery: true } },
    );

    return json({ url: signed.url, key, expires_in: PUT_TTL_SECS, content_type: contentType, max_bytes: MAX_BYTES });
  }

  if (body.op === "get") {
    const key = typeof body.key === "string" ? body.key : null;
    if (!key) return json({ error: "key required" }, 400);

    const url = `${baseUrl}/${key}?X-Amz-Expires=${GET_TTL_SECS}`;
    const signed = await aws.sign(
      new Request(url, { method: "GET" }),
      { aws: { signQuery: true } },
    );
    return json({ url: signed.url, expires_in: GET_TTL_SECS });
  }

  return json({ error: "Unknown op" }, 400);
});

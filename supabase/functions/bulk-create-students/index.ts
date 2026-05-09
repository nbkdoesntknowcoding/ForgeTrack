// Supabase Edge Function: bulk-create-students
// Mentor-only. For every active student in public.students:
//   1. Delete any existing auth.users row keyed by `<usn>@forge.local`
//   2. Re-create via supabase.auth.admin.createUser() — sets ALL required fields
//      properly (instance_id, identities row, etc.) so login actually works
//   3. Upsert public.users row with role=student and student_id linking
//
// This exists because raw SQL INSERTs into auth.users miss columns recent
// Supabase versions check at login, leading to "Database error querying schema".
// The admin API is the supported way and handles all that internally.
//
// Body:    { delete_only?: boolean }   default: recreate all
// Returns: { created: n, deleted: n, skipped: n, errors: [...] }

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify caller is a mentor.
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return json({ error: "Unauthenticated" }, 401);
  const { data: profile } = await userClient
    .from("users").select("role").eq("id", userRes.user.id).single();
  if (profile?.role !== "mentor") return json({ error: "Mentor role required" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Pull active students.
  const { data: students, error: stuErr } = await admin
    .from("students").select("id, name, usn").eq("is_active", true);
  if (stuErr) return json({ error: stuErr.message }, 500);

  let created = 0;
  let deleted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const s of students || []) {
    if (!s.usn) { skipped += 1; continue; }
    const email = `${s.usn.toLowerCase()}@forge.local`;
    const password = s.usn; // initial password = USN

    try {
      // 1. Delete existing public.users row for this student (if any).
      await admin.from("users").delete().eq("student_id", s.id);

      // 2. Look up existing auth user by email. listUsers paginates; query directly.
      const { data: existing } = await admin
        .schema("auth").from("users").select("id").eq("email", email).maybeSingle();
      if (existing?.id) {
        await admin.auth.admin.deleteUser(existing.id);
        deleted += 1;
      }

      // 3. Create via admin API — sets all required fields correctly.
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: s.name, student_id: s.id },
      });
      if (createErr) throw createErr;
      if (!newUser?.user?.id) throw new Error("createUser returned no id");

      // 4. Insert profile row.
      const { error: profErr } = await admin.from("users").insert({
        id: newUser.user.id,
        email,
        role: "student",
        display_name: s.name,
        student_id: s.id,
      });
      if (profErr) throw profErr;

      created += 1;
    } catch (err) {
      errors.push(`${s.usn}: ${(err as Error).message || String(err)}`);
    }
  }

  return json({ created, deleted, skipped, errors });
});

import { createClient } from "@supabase/supabase-js";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { ...jsonHeaders, Allow: "POST" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "FUNCTION_NOT_CONFIGURED" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("refresh_negotiation_alerts");

  if (error) {
    console.error("refresh_negotiation_alerts failed", error.message);
    return new Response(JSON.stringify({ error: "REFRESH_FAILED" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  return new Response(
    JSON.stringify({ success: true, affected: data, refreshedAt: new Date().toISOString() }),
    { status: 200, headers: jsonHeaders },
  );
});

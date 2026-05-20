import { supabase } from "@/integrations/supabase/client";

export async function getSchoolId(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("غير مسجل دخول");
  const { data, error } = await supabase.from("profiles").select("school_id").eq("id", u.user.id).single();
  if (error || !data?.school_id) throw new Error("لم يتم تحديد المدرسة");
  return data.school_id;
}

export async function logAction(action: string, entity?: string, entity_id?: string, meta?: Record<string, unknown>) {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: p } = await supabase.from("profiles").select("school_id").eq("id", u.user.id).single();
    await supabase.from("audit_logs").insert({
      user_id: u.user.id, school_id: p?.school_id ?? null,
      action, entity, entity_id, meta: meta as never,
    });
  } catch (e) { console.warn("audit log failed", e); }
}

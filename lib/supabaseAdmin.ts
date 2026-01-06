// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// IMPORTANT: never expose SUPABASE_SERVICE_ROLE_KEY to the client
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

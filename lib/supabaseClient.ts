// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const url = "https://jdflcetfmfdhicntvlbp.supabase.co";
const key = "sb_publishable_giJLM2wjPxbM0DU3vT91xw_KehDP1zm";

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

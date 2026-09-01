import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Cliente con la service_role key: se salta RLS por completo. Solo se debe
// usar en server actions ya protegidas por requireRole, para operaciones
// que el rol anon/authenticated no puede hacer (ej. crear usuarios).
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

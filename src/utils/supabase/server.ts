import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function createClient(cookieStore?: Awaited<ReturnType<typeof cookies>>) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase server client is not configured.");
  }

  const store = cookieStore ?? (await cookies());

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. The Next proxy refreshes sessions when Supabase auth is used.
        }
      }
    }
  });
}

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tudo exceto arquivos estáticos, service worker, manifest, ícones e API de cron/push.
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|api/cron|api/push/send|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt)$).*)",
  ],
};

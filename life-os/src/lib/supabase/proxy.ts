import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/cadastro", "/recuperar-senha", "/redefinir-senha", "/auth", "/offline", "/configurar"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  if (!url || !anonKey) {
    // Supabase não configurado: envia para a página de configuração.
    if (path !== "/configurar") {
      return NextResponse.redirect(new URL("/configurar", request.url));
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Não usar getSession() aqui: getUser() valida o token no servidor do Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const redirect = new URL("/login", request.url);
    if (path !== "/") redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (user && (path === "/login" || path === "/cadastro" || path === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!user && path === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

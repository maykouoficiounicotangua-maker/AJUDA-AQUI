import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/** Rotas que exigem login. A autorização real continua no banco (RLS) e nas actions. */
const PRIVATE_PREFIXES = [
  "/inicio", "/meus-pedidos", "/minhas-ajudas", "/mensagens", "/conversa",
  "/perfil", "/usuario", "/notificacoes", "/configuracoes", "/favoritos", "/admin", "/boas-vindas", "/aceitar-termos",
];
const AUTH_PAGES = ["/entrar", "/cadastrar", "/recuperar-senha"];

function matches(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

/** Explorar, detalhe e criação de pedido são abertos a visitantes; editar um pedido não. */
const isPrivate = (path: string) => matches(path, PRIVATE_PREFIXES) || /^\/pedido\/[^/]+\/editar\/?$/.test(path);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    // Sem Supabase configurado: páginas privadas mostram o aviso de configuração.
    return response;
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser valida o token com o servidor Auth (não confia só no cookie) e renova a sessão.
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user && isPrivate(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  if (user && matches(pathname, AUTH_PAGES)) {
    // já logado: segue para onde ia (somente caminhos internos) ou para o início
    const next = request.nextUrl.searchParams.get("next") ?? "";
    const safe = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/inicio";
    return NextResponse.redirect(new URL(safe, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // tudo, exceto estáticos, imagens e o service worker
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas públicas que não precisam de autenticação
const publicRoutes = ["/login", "/api/auth/login", "/api/webhooks"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignora arquivos estáticos e assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Verifica se é uma rota pública
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Se for uma rota pública, permite o acesso
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Obtém o token do cookie
  const token = request.cookies.get("auth-token")?.value;

  // Se não houver token, redireciona para login
  if (!token) {
    // Se for API, retorna 401
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Token existe, permite acesso (validação completa é feita nas APIs/páginas)
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

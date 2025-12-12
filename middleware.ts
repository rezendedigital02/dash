import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

// Rotas públicas que não precisam de autenticação
const publicRoutes = ["/login", "/api/auth/login", "/api/webhooks"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Verifica se é uma rota pública
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Se for uma rota pública, permite o acesso
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Verifica se é uma rota de API
  const isApiRoute = pathname.startsWith("/api");

  // Obtém o token do cookie ou header
  const token =
    request.cookies.get("auth-token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  // Se não houver token
  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verifica se o token é válido
  const payload = verifyToken(token);

  if (!payload) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }
    // Remove o cookie inválido e redireciona
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("auth-token");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};

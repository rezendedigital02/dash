import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTokensFromCode, listCalendars } from "@/lib/google-calendar";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

// GET /api/google/callback - Callback do OAuth do Google
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("Erro na autorização Google:", error);
      return NextResponse.redirect(
        new URL("/dashboard?google=error&message=" + error, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/dashboard?google=error&message=no_code", request.url)
      );
    }

    // Troca o código por tokens
    const tokens = await getTokensFromCode(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL("/dashboard?google=error&message=no_refresh_token", request.url)
      );
    }

    // Lista os calendários para pegar o principal
    const calendars = await listCalendars(tokens.refresh_token);
    const primaryCalendar = calendars.find((c) => c.primary) || calendars[0];

    // Salva o refresh token e calendar ID no banco
    await prisma.usuario.update({
      where: { id: user.userId },
      data: {
        googleRefreshToken: tokens.refresh_token,
        googleCalendarId: primaryCalendar?.id || "primary",
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard?google=success", request.url)
    );
  } catch (error) {
    console.error("Erro no callback Google:", error);
    return NextResponse.redirect(
      new URL("/dashboard?google=error&message=callback_error", request.url)
    );
  }
}

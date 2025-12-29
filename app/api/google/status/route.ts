import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

// GET /api/google/status - Verifica se o Google Calendar está conectado
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: user.userId },
      select: {
        googleCalendarId: true,
        googleRefreshToken: true,
      },
    });

    const connected = !!(usuario?.googleRefreshToken && usuario?.googleCalendarId);

    return NextResponse.json({
      connected,
      calendarId: usuario?.googleCalendarId || null,
    });
  } catch (error) {
    console.error("Erro ao verificar status Google:", error);
    return NextResponse.json(
      { error: "Erro ao verificar conexão" },
      { status: 500 }
    );
  }
}

// DELETE /api/google/status - Desconecta o Google Calendar
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await prisma.usuario.update({
      where: { id: user.userId },
      data: {
        googleCalendarId: null,
        googleRefreshToken: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao desconectar Google:", error);
    return NextResponse.json(
      { error: "Erro ao desconectar" },
      { status: 500 }
    );
  }
}

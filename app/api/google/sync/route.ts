import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  createCalendarEvent,
  formatAgendamentoToEvent,
} from "@/lib/google-calendar";

// POST /api/google/sync - Sincroniza agendamentos sem googleEventId com o Calendar
export async function POST() {
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

    if (!usuario?.googleRefreshToken || !usuario?.googleCalendarId) {
      return NextResponse.json(
        { error: "Google Calendar não conectado" },
        { status: 400 }
      );
    }

    // Busca agendamentos sem googleEventId
    const agendamentos = await prisma.agendamento.findMany({
      where: {
        usuarioId: user.userId,
        googleEventId: null,
        status: "confirmado",
      },
    });

    let synced = 0;
    let errors = 0;

    for (const agendamento of agendamentos) {
      try {
        const eventData = formatAgendamentoToEvent({
          ...agendamento,
          dataHora: new Date(agendamento.dataHora),
        });

        const event = await createCalendarEvent(
          usuario.googleRefreshToken,
          usuario.googleCalendarId,
          eventData
        );

        if (event.id) {
          await prisma.agendamento.update({
            where: { id: agendamento.id },
            data: { googleEventId: event.id },
          });
          synced++;
        }
      } catch (error) {
        console.error(`Erro ao sincronizar agendamento ${agendamento.id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      errors,
      total: agendamentos.length,
    });
  } catch (error) {
    console.error("Erro na sincronização:", error);
    return NextResponse.json(
      { error: "Erro ao sincronizar" },
      { status: 500 }
    );
  }
}

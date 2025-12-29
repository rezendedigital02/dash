import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  createCalendarEvent,
  formatAgendamentoToEvent,
  formatBloqueioToEvent,
} from "@/lib/google-calendar";

export const dynamic = 'force-dynamic';

// POST /api/google/sync - Sincroniza agendamentos e bloqueios sem googleEventId com o Calendar
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

    let syncedAgendamentos = 0;
    let syncedBloqueios = 0;
    let errors = 0;

    // ============ SINCRONIZAR AGENDAMENTOS ============
    const agendamentos = await prisma.agendamento.findMany({
      where: {
        usuarioId: user.userId,
        googleEventId: null,
        status: "confirmado",
      },
    });

    console.log(`[Sync] Encontrados ${agendamentos.length} agendamentos para sincronizar`);

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
          syncedAgendamentos++;
          console.log(`[Sync] Agendamento ${agendamento.id} sincronizado`);
        }
      } catch (error) {
        console.error(`[Sync] Erro ao sincronizar agendamento ${agendamento.id}:`, error);
        errors++;
      }
    }

    // ============ SINCRONIZAR BLOQUEIOS ============
    const bloqueios = await prisma.bloqueio.findMany({
      where: {
        usuarioId: user.userId,
        googleEventId: null,
        ativo: true,
      },
    });

    console.log(`[Sync] Encontrados ${bloqueios.length} bloqueios para sincronizar`);

    for (const bloqueio of bloqueios) {
      try {
        const eventData = formatBloqueioToEvent({
          tipo: bloqueio.tipo,
          data: new Date(bloqueio.data),
          horaInicio: bloqueio.horaInicio,
          horaFim: bloqueio.horaFim,
          motivo: bloqueio.motivo,
        });

        const event = await createCalendarEvent(
          usuario.googleRefreshToken,
          usuario.googleCalendarId,
          eventData
        );

        if (event.id) {
          await prisma.bloqueio.update({
            where: { id: bloqueio.id },
            data: { googleEventId: event.id },
          });
          syncedBloqueios++;
          console.log(`[Sync] Bloqueio ${bloqueio.id} sincronizado`);
        }
      } catch (error) {
        console.error(`[Sync] Erro ao sincronizar bloqueio ${bloqueio.id}:`, error);
        errors++;
      }
    }

    const totalSynced = syncedAgendamentos + syncedBloqueios;

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      syncedAgendamentos,
      syncedBloqueios,
      errors,
      totalAgendamentos: agendamentos.length,
      totalBloqueios: bloqueios.length,
    });
  } catch (error) {
    console.error("[Sync] Erro na sincronização:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("invalid_grant") || errorMessage.includes("Token")) {
      return NextResponse.json(
        { error: "Token do Google expirado. Por favor, reconecte sua conta Google." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: `Erro ao sincronizar: ${errorMessage.substring(0, 100)}` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createCalendarEvent } from "@/lib/google-calendar";

// GET /api/bloqueios - Lista bloqueios ativos
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const bloqueios = await prisma.bloqueio.findMany({
      where: {
        usuarioId: user.userId,
        ativo: true,
      },
      orderBy: { data: "asc" },
    });

    return NextResponse.json(bloqueios);
  } catch (error) {
    console.error("Erro ao listar bloqueios:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/bloqueios - Cria novo bloqueio
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { tipo, data, horaInicio, horaFim, motivo } = body;

    // Validação
    if (!tipo || !data) {
      return NextResponse.json(
        { error: "Tipo e data são obrigatórios" },
        { status: 400 }
      );
    }

    if (tipo !== "horario" && tipo !== "dia_inteiro") {
      return NextResponse.json(
        { error: "Tipo inválido" },
        { status: 400 }
      );
    }

    if (tipo === "horario" && (!horaInicio || !horaFim)) {
      return NextResponse.json(
        { error: "Horário de início e fim são obrigatórios para bloqueio de horário" },
        { status: 400 }
      );
    }

    const dataBloqueio = new Date(data);

    // Busca dados do usuário para Google Calendar
    const usuario = await prisma.usuario.findUnique({
      where: { id: user.userId },
      select: {
        googleCalendarId: true,
        googleRefreshToken: true,
      },
    });

    let googleEventId: string | null = null;

    // Se Google Calendar estiver conectado, cria evento de bloqueio
    if (usuario?.googleRefreshToken && usuario?.googleCalendarId) {
      try {
        let startDateTime: Date;
        let endDateTime: Date;

        if (tipo === "dia_inteiro") {
          // Bloqueio de dia inteiro: 08:00 às 18:00
          startDateTime = new Date(dataBloqueio);
          startDateTime.setHours(8, 0, 0, 0);
          endDateTime = new Date(dataBloqueio);
          endDateTime.setHours(18, 0, 0, 0);
        } else {
          // Bloqueio de horário específico
          const [horaIni, minIni] = horaInicio.split(":").map(Number);
          const [horaFi, minFi] = horaFim.split(":").map(Number);
          startDateTime = new Date(dataBloqueio);
          startDateTime.setHours(horaIni, minIni, 0, 0);
          endDateTime = new Date(dataBloqueio);
          endDateTime.setHours(horaFi, minFi, 0, 0);
        }

        const event = await createCalendarEvent(
          usuario.googleRefreshToken,
          usuario.googleCalendarId,
          {
            summary: `BLOQUEADO${motivo ? ` - ${motivo}` : ""}`,
            description: tipo === "dia_inteiro"
              ? "Bloqueio de dia inteiro"
              : `Bloqueio de ${horaInicio} às ${horaFim}`,
            startDateTime,
            endDateTime,
          }
        );

        googleEventId = event.id || null;
      } catch (error) {
        console.error("Erro ao criar evento de bloqueio no Calendar:", error);
      }
    }

    // Cria o bloqueio
    const bloqueio = await prisma.bloqueio.create({
      data: {
        usuarioId: user.userId,
        tipo,
        data: dataBloqueio,
        horaInicio: tipo === "horario" ? horaInicio : null,
        horaFim: tipo === "horario" ? horaFim : null,
        motivo,
        ativo: true,
        googleEventId,
      },
    });

    // Envia webhook para n8n
    await enviarWebhook("bloquear", {
      bloqueioId: bloqueio.id,
      tipo,
      data: dataBloqueio.toISOString(),
      horaInicio,
      horaFim,
      motivo,
      clinica: user.clinica,
    });

    return NextResponse.json(bloqueio, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar bloqueio:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

async function enviarWebhook(tipo: string, dados: any) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(`${webhookUrl}/${tipo}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET || "",
      },
      body: JSON.stringify(dados),
    });
  } catch (error) {
    console.error("Erro ao enviar webhook:", error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { startOfDay, endOfDay } from "date-fns";
import { createCalendarEvent, formatAgendamentoToEvent } from "@/lib/google-calendar";

// GET /api/agendamentos - Lista agendamentos (filtrado por data)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dataStr = searchParams.get("data");

    let whereClause: any = { usuarioId: user.userId };

    if (dataStr) {
      const data = new Date(dataStr);
      whereClause.dataHora = {
        gte: startOfDay(data),
        lte: endOfDay(data),
      };
    }

    const agendamentos = await prisma.agendamento.findMany({
      where: whereClause,
      orderBy: { dataHora: "asc" },
    });

    return NextResponse.json(agendamentos);
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/agendamentos - Cria novo agendamento
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { pacienteNome, pacienteTelefone, pacienteEmail, dataHora, tipo, observacoes } = body;

    // Validação
    if (!pacienteNome || !pacienteTelefone || !dataHora || !tipo) {
      return NextResponse.json(
        { error: "Campos obrigatórios faltando" },
        { status: 400 }
      );
    }

    const dataAgendamento = new Date(dataHora);

    // Verifica se o horário está bloqueado
    const bloqueioExistente = await prisma.bloqueio.findFirst({
      where: {
        usuarioId: user.userId,
        ativo: true,
        data: {
          gte: startOfDay(dataAgendamento),
          lte: endOfDay(dataAgendamento),
        },
      },
    });

    if (bloqueioExistente) {
      if (bloqueioExistente.tipo === "dia_inteiro") {
        return NextResponse.json(
          { error: "Este dia está bloqueado" },
          { status: 400 }
        );
      }

      if (bloqueioExistente.horaInicio && bloqueioExistente.horaFim) {
        const hora = dataAgendamento.toTimeString().slice(0, 5);
        if (hora >= bloqueioExistente.horaInicio && hora < bloqueioExistente.horaFim) {
          return NextResponse.json(
            { error: "Este horário está bloqueado" },
            { status: 400 }
          );
        }
      }
    }

    // Verifica se já existe agendamento no mesmo horário
    const agendamentoExistente = await prisma.agendamento.findFirst({
      where: {
        usuarioId: user.userId,
        dataHora: dataAgendamento,
        status: "confirmado",
      },
    });

    if (agendamentoExistente) {
      return NextResponse.json(
        { error: "Já existe um agendamento neste horário" },
        { status: 400 }
      );
    }

    // Busca dados do usuário para Google Calendar
    const usuario = await prisma.usuario.findUnique({
      where: { id: user.userId },
      select: {
        googleCalendarId: true,
        googleRefreshToken: true,
      },
    });

    // Cria o agendamento
    let googleEventId: string | null = null;

    // Se Google Calendar estiver conectado, cria o evento
    if (usuario?.googleRefreshToken && usuario?.googleCalendarId) {
      try {
        const eventData = formatAgendamentoToEvent({
          pacienteNome,
          pacienteTelefone,
          pacienteEmail,
          tipo,
          observacoes,
          dataHora: dataAgendamento,
        });

        const event = await createCalendarEvent(
          usuario.googleRefreshToken,
          usuario.googleCalendarId,
          eventData
        );

        googleEventId = event.id || null;
      } catch (error) {
        console.error("Erro ao criar evento no Google Calendar:", error);
        // Continua mesmo sem criar o evento no Calendar
      }
    }

    const agendamento = await prisma.agendamento.create({
      data: {
        usuarioId: user.userId,
        pacienteNome,
        pacienteTelefone,
        pacienteEmail,
        dataHora: dataAgendamento,
        tipo,
        observacoes,
        origem: "manual",
        status: "confirmado",
        googleEventId,
      },
    });

    // Envia webhook para n8n (se configurado)
    await enviarWebhook("agendar", {
      agendamentoId: agendamento.id,
      pacienteNome,
      pacienteTelefone,
      pacienteEmail,
      dataHora: dataAgendamento.toISOString(),
      tipo,
      clinica: user.clinica,
    });

    return NextResponse.json(agendamento, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
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

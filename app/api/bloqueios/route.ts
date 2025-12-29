import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createCalendarEvent, formatBloqueioToEvent } from "@/lib/google-calendar";

export const dynamic = 'force-dynamic';

// GET /api/bloqueios - Lista bloqueios ativos
export async function GET() {
  console.log("[API Bloqueios] GET - Iniciando...");

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log("[API Bloqueios] GET - Usuário não autenticado");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    console.log("[API Bloqueios] GET - Usuário:", user.userId);

    const bloqueios = await prisma.bloqueio.findMany({
      where: {
        usuarioId: user.userId,
        ativo: true,
      },
      orderBy: { data: "asc" },
    });

    console.log("[API Bloqueios] GET - Encontrados:", bloqueios.length, "bloqueios");
    return NextResponse.json(bloqueios);
  } catch (error) {
    console.error("[API Bloqueios] GET - Erro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/bloqueios - Cria novo bloqueio
export async function POST(request: NextRequest) {
  console.log("[API Bloqueios] POST - Iniciando criação de bloqueio...");

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log("[API Bloqueios] POST - Usuário não autenticado");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    console.log("[API Bloqueios] POST - Usuário:", user.userId);

    const body = await request.json();
    console.log("[API Bloqueios] POST - Dados recebidos:", JSON.stringify(body, null, 2));

    const { tipo, data, horaInicio, horaFim, motivo } = body;

    // Validação
    if (!tipo || !data) {
      console.log("[API Bloqueios] POST - Tipo e data são obrigatórios");
      return NextResponse.json(
        { error: "Tipo e data são obrigatórios" },
        { status: 400 }
      );
    }

    if (tipo !== "horario" && tipo !== "dia_inteiro") {
      console.log("[API Bloqueios] POST - Tipo inválido:", tipo);
      return NextResponse.json(
        { error: "Tipo inválido" },
        { status: 400 }
      );
    }

    if (tipo === "horario" && (!horaInicio || !horaFim)) {
      console.log("[API Bloqueios] POST - Horários faltando para tipo 'horario'");
      return NextResponse.json(
        { error: "Horário de início e fim são obrigatórios para bloqueio de horário" },
        { status: 400 }
      );
    }

    const dataBloqueio = new Date(data);
    console.log("[API Bloqueios] POST - Data do bloqueio:", dataBloqueio);

    // Busca dados do usuário para Google Calendar
    const usuario = await prisma.usuario.findUnique({
      where: { id: user.userId },
      select: {
        googleCalendarId: true,
        googleRefreshToken: true,
      },
    });

    let googleEventId: string | null = null;
    let googleCalendarWarning: string | null = null;

    // Se Google Calendar estiver conectado, cria evento de bloqueio
    if (usuario?.googleRefreshToken && usuario?.googleCalendarId) {
      console.log("[API Bloqueios] POST - Criando evento de bloqueio no Google Calendar...");
      try {
        const eventData = formatBloqueioToEvent({
          tipo,
          data: dataBloqueio,
          horaInicio,
          horaFim,
          motivo,
        });

        const event = await createCalendarEvent(
          usuario.googleRefreshToken,
          usuario.googleCalendarId,
          eventData
        );

        googleEventId = event.id || null;
        console.log("[API Bloqueios] POST - Evento criado no Calendar:", googleEventId);
      } catch (calendarError) {
        const errorMsg = calendarError instanceof Error ? calendarError.message : String(calendarError);
        console.error("[API Bloqueios] POST - Erro ao criar evento no Calendar:", errorMsg);

        // Verifica tipo de erro
        if (errorMsg.includes("invalid_grant") || errorMsg.includes("Token")) {
          googleCalendarWarning = "Token do Google expirado. Bloqueio salvo localmente. Reconecte o Google e clique em Sincronizar.";
        } else {
          googleCalendarWarning = "Falha ao sincronizar com Google Calendar. Clique em 'Sincronizar' para tentar novamente.";
        }
      }
    } else {
      console.log("[API Bloqueios] POST - Google Calendar não configurado para este usuário");
    }

    // Cria o bloqueio no banco de dados
    console.log("[API Bloqueios] POST - Salvando no banco de dados...");
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

    console.log("[API Bloqueios] POST - Bloqueio criado com sucesso:", bloqueio.id);

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

    // Retorna com warning se houve problema no Calendar
    return NextResponse.json({
      ...bloqueio,
      warning: googleCalendarWarning,
    }, { status: 201 });
  } catch (error) {
    console.error("[API Bloqueios] POST - Erro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

async function enviarWebhook(tipo: string, dados: any) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("[Webhook] URL não configurada, pulando...");
    return;
  }

  console.log("[Webhook] Enviando para:", `${webhookUrl}/${tipo}`);
  try {
    await fetch(`${webhookUrl}/${tipo}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET || "",
      },
      body: JSON.stringify(dados),
    });
    console.log("[Webhook] Enviado com sucesso");
  } catch (error) {
    console.error("[Webhook] Erro ao enviar:", error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

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

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

// POST /api/webhooks/agendar - Webhook para criar agendamento (usado pelo agente IA)
export async function POST(request: NextRequest) {
  try {
    // Verifica o secret do webhook
    const webhookSecret = request.headers.get("x-webhook-secret");
    if (webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      usuarioId,
      pacienteNome,
      pacienteTelefone,
      pacienteEmail,
      dataHora,
      tipo,
      observacoes,
      googleEventId,
    } = body;

    // Validação básica
    if (!usuarioId || !pacienteNome || !pacienteTelefone || !dataHora || !tipo) {
      return NextResponse.json(
        { error: "Campos obrigatórios faltando" },
        { status: 400 }
      );
    }

    // Verifica se o usuário existe
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    // Cria o agendamento
    const agendamento = await prisma.agendamento.create({
      data: {
        usuarioId,
        pacienteNome,
        pacienteTelefone,
        pacienteEmail,
        dataHora: new Date(dataHora),
        tipo,
        observacoes,
        googleEventId,
        origem: "agente_ia",
        status: "confirmado",
      },
    });

    return NextResponse.json(agendamento, { status: 201 });
  } catch (error) {
    console.error("Erro no webhook de agendamento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

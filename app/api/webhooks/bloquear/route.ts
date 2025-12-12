import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST /api/webhooks/bloquear - Webhook para criar bloqueio (usado pelo agente IA)
export async function POST(request: NextRequest) {
  try {
    // Verifica o secret do webhook
    const webhookSecret = request.headers.get("x-webhook-secret");
    if (webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { usuarioId, tipo, data, horaInicio, horaFim, motivo } = body;

    // Validação básica
    if (!usuarioId || !tipo || !data) {
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

    // Cria o bloqueio
    const bloqueio = await prisma.bloqueio.create({
      data: {
        usuarioId,
        tipo,
        data: new Date(data),
        horaInicio: tipo === "horario" ? horaInicio : null,
        horaFim: tipo === "horario" ? horaFim : null,
        motivo,
        ativo: true,
      },
    });

    return NextResponse.json(bloqueio, { status: 201 });
  } catch (error) {
    console.error("Erro no webhook de bloqueio:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

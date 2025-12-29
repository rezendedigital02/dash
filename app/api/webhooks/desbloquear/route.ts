import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

// DELETE /api/webhooks/desbloquear - Webhook para remover bloqueio (usado pelo agente IA)
export async function DELETE(request: NextRequest) {
  try {
    // Verifica o secret do webhook
    const webhookSecret = request.headers.get("x-webhook-secret");
    if (webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { bloqueioId, usuarioId } = body;

    // Validação básica
    if (!bloqueioId || !usuarioId) {
      return NextResponse.json(
        { error: "bloqueioId e usuarioId são obrigatórios" },
        { status: 400 }
      );
    }

    // Verifica se o bloqueio existe e pertence ao usuário
    const bloqueio = await prisma.bloqueio.findFirst({
      where: {
        id: bloqueioId,
        usuarioId,
      },
    });

    if (!bloqueio) {
      return NextResponse.json(
        { error: "Bloqueio não encontrado" },
        { status: 404 }
      );
    }

    // Desativa o bloqueio
    await prisma.bloqueio.update({
      where: { id: bloqueioId },
      data: { ativo: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no webhook de desbloqueio:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

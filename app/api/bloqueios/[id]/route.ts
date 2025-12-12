import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// DELETE /api/bloqueios/[id] - Remove bloqueio
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Verifica se o bloqueio existe e pertence ao usuário
    const bloqueio = await prisma.bloqueio.findFirst({
      where: {
        id,
        usuarioId: user.userId,
      },
    });

    if (!bloqueio) {
      return NextResponse.json(
        { error: "Bloqueio não encontrado" },
        { status: 404 }
      );
    }

    // Desativa o bloqueio ao invés de deletar (soft delete)
    await prisma.bloqueio.update({
      where: { id },
      data: { ativo: false },
    });

    // Envia webhook para n8n
    await enviarWebhook("desbloquear", {
      bloqueioId: bloqueio.id,
      tipo: bloqueio.tipo,
      data: bloqueio.data.toISOString(),
      clinica: user.clinica,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar bloqueio:", error);
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
      method: "DELETE",
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

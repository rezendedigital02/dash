import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { deleteCalendarEvent } from "@/lib/google-calendar";

export const dynamic = 'force-dynamic';

// DELETE /api/bloqueios/[id] - Remove bloqueio
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("[API Bloqueios] DELETE - Iniciando remoção de bloqueio...");

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log("[API Bloqueios] DELETE - Usuário não autenticado");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    console.log("[API Bloqueios] DELETE - ID do bloqueio:", id);

    // Verifica se o bloqueio existe e pertence ao usuário
    const bloqueio = await prisma.bloqueio.findFirst({
      where: {
        id,
        usuarioId: user.userId,
      },
      include: {
        usuario: {
          select: {
            googleCalendarId: true,
            googleRefreshToken: true,
          },
        },
      },
    });

    if (!bloqueio) {
      console.log("[API Bloqueios] DELETE - Bloqueio não encontrado");
      return NextResponse.json(
        { error: "Bloqueio não encontrado" },
        { status: 404 }
      );
    }

    console.log("[API Bloqueios] DELETE - Bloqueio encontrado:", bloqueio.id);

    // Se tiver evento no Google Calendar, deleta
    if (
      bloqueio.googleEventId &&
      bloqueio.usuario.googleRefreshToken &&
      bloqueio.usuario.googleCalendarId
    ) {
      console.log("[API Bloqueios] DELETE - Deletando evento do Google Calendar...");
      try {
        await deleteCalendarEvent(
          bloqueio.usuario.googleRefreshToken,
          bloqueio.usuario.googleCalendarId,
          bloqueio.googleEventId
        );
        console.log("[API Bloqueios] DELETE - Evento deletado do Calendar");
      } catch (calendarError) {
        console.error("[API Bloqueios] DELETE - Erro ao deletar do Calendar:", calendarError);
        // Continua mesmo se falhar no Calendar
      }
    }

    // Desativa o bloqueio (soft delete)
    console.log("[API Bloqueios] DELETE - Desativando bloqueio no banco...");
    await prisma.bloqueio.update({
      where: { id },
      data: { ativo: false },
    });

    console.log("[API Bloqueios] DELETE - Bloqueio removido com sucesso");

    // Envia webhook para n8n
    await enviarWebhook("desbloquear", {
      bloqueioId: bloqueio.id,
      tipo: bloqueio.tipo,
      data: bloqueio.data.toISOString(),
      clinica: user.clinica,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API Bloqueios] DELETE - Erro:", error);
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

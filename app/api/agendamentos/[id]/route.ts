import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { deleteCalendarEvent } from "@/lib/google-calendar";

export const dynamic = 'force-dynamic';

// DELETE /api/agendamentos/[id] - Cancela/Remove agendamento
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("[API Agendamentos] DELETE - Iniciando cancelamento...");

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log("[API Agendamentos] DELETE - Usuário não autenticado");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    console.log("[API Agendamentos] DELETE - ID do agendamento:", id);

    // Verifica se o agendamento existe e pertence ao usuário
    const agendamento = await prisma.agendamento.findFirst({
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

    if (!agendamento) {
      console.log("[API Agendamentos] DELETE - Agendamento não encontrado");
      return NextResponse.json(
        { error: "Agendamento não encontrado" },
        { status: 404 }
      );
    }

    console.log("[API Agendamentos] DELETE - Agendamento encontrado:", agendamento.pacienteNome);
    console.log("[API Agendamentos] DELETE - googleEventId:", agendamento.googleEventId);

    // Se tiver evento no Google Calendar, deleta
    if (
      agendamento.googleEventId &&
      agendamento.usuario.googleRefreshToken &&
      agendamento.usuario.googleCalendarId
    ) {
      console.log("[API Agendamentos] DELETE - Deletando evento do Google Calendar...");
      try {
        await deleteCalendarEvent(
          agendamento.usuario.googleRefreshToken,
          agendamento.usuario.googleCalendarId,
          agendamento.googleEventId
        );
        console.log("[API Agendamentos] DELETE - Evento deletado do Calendar com sucesso");
      } catch (calendarError) {
        console.error("[API Agendamentos] DELETE - Erro ao deletar do Calendar:", calendarError);
        // Continua mesmo se falhar no Calendar
      }
    } else {
      console.log("[API Agendamentos] DELETE - Sem evento no Google Calendar para deletar");
    }

    // Atualiza status para cancelado (soft delete) ou deleta completamente
    console.log("[API Agendamentos] DELETE - Atualizando status para cancelado...");
    await prisma.agendamento.update({
      where: { id },
      data: { status: "cancelado" },
    });

    console.log("[API Agendamentos] DELETE - Agendamento cancelado com sucesso");

    // Envia webhook para n8n
    await enviarWebhook("cancelar", {
      agendamentoId: agendamento.id,
      pacienteNome: agendamento.pacienteNome,
      pacienteTelefone: agendamento.pacienteTelefone,
      dataHora: agendamento.dataHora.toISOString(),
      clinica: user.clinica,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API Agendamentos] DELETE - Erro:", error);
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

// PATCH /api/agendamentos/[id] - Atualiza agendamento
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verifica se o agendamento existe e pertence ao usuário
    const agendamentoExistente = await prisma.agendamento.findFirst({
      where: {
        id,
        usuarioId: user.userId,
      },
    });

    if (!agendamentoExistente) {
      return NextResponse.json(
        { error: "Agendamento não encontrado" },
        { status: 404 }
      );
    }

    // Atualiza apenas os campos permitidos
    const agendamento = await prisma.agendamento.update({
      where: { id },
      data: {
        ...(body.pacienteNome && { pacienteNome: body.pacienteNome }),
        ...(body.pacienteTelefone && { pacienteTelefone: body.pacienteTelefone }),
        ...(body.pacienteEmail !== undefined && { pacienteEmail: body.pacienteEmail }),
        ...(body.dataHora && { dataHora: new Date(body.dataHora) }),
        ...(body.tipo && { tipo: body.tipo }),
        ...(body.observacoes !== undefined && { observacoes: body.observacoes }),
        ...(body.status && { status: body.status }),
      },
    });

    return NextResponse.json(agendamento);
  } catch (error) {
    console.error("Erro ao atualizar agendamento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

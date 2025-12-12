import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// DELETE /api/agendamentos/[id] - Remove agendamento
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

    // Verifica se o agendamento existe e pertence ao usuário
    const agendamento = await prisma.agendamento.findFirst({
      where: {
        id,
        usuarioId: user.userId,
      },
    });

    if (!agendamento) {
      return NextResponse.json(
        { error: "Agendamento não encontrado" },
        { status: 404 }
      );
    }

    await prisma.agendamento.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar agendamento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
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

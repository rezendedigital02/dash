import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

// GET /api/stats - Retorna estatísticas do dashboard
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const hoje = new Date();

    // Agendamentos de hoje
    const agendamentosHoje = await prisma.agendamento.count({
      where: {
        usuarioId: user.userId,
        dataHora: {
          gte: startOfDay(hoje),
          lte: endOfDay(hoje),
        },
        status: "confirmado",
      },
    });

    // Agendamentos da semana
    const totalSemana = await prisma.agendamento.count({
      where: {
        usuarioId: user.userId,
        dataHora: {
          gte: startOfWeek(hoje, { weekStartsOn: 0 }),
          lte: endOfWeek(hoje, { weekStartsOn: 0 }),
        },
        status: "confirmado",
      },
    });

    // Bloqueios ativos
    const bloqueiosAtivos = await prisma.bloqueio.count({
      where: {
        usuarioId: user.userId,
        ativo: true,
      },
    });

    return NextResponse.json({
      agendamentosHoje,
      totalSemana,
      bloqueiosAtivos,
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

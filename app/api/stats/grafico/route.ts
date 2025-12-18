import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

// GET /api/stats/grafico - Retorna dados para o gráfico de agendamentos
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const inicioStr = searchParams.get("inicio");
    const fimStr = searchParams.get("fim");

    if (!inicioStr || !fimStr) {
      return NextResponse.json(
        { error: "Datas de início e fim são obrigatórias" },
        { status: 400 }
      );
    }

    const inicio = new Date(inicioStr);
    const fim = new Date(fimStr);
    const diasDiferenca = differenceInDays(fim, inicio);

    // Busca todos os agendamentos no período
    const agendamentos = await prisma.agendamento.findMany({
      where: {
        usuarioId: user.userId,
        dataHora: {
          gte: inicio,
          lte: fim,
        },
        status: "confirmado",
      },
      select: {
        dataHora: true,
        tipo: true,
      },
    });

    // Agrupa por tipo para o gráfico de pizza
    const tiposMap = new Map<string, number>();
    const TIPOS_LABEL: Record<string, string> = {
      consulta: "Consulta",
      retorno: "Retorno",
      procedimento: "Procedimento",
      avaliacao: "Avaliação",
      emergencia: "Emergência",
    };

    agendamentos.forEach((a) => {
      const tipoLabel = TIPOS_LABEL[a.tipo] || a.tipo;
      tiposMap.set(tipoLabel, (tiposMap.get(tipoLabel) || 0) + 1);
    });

    const tiposData = Array.from(tiposMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    let chartData: { name: string; agendamentos: number }[] = [];

    // Decide o agrupamento baseado no período
    if (diasDiferenca <= 14) {
      // Agrupa por dia
      const dias = eachDayOfInterval({ start: inicio, end: fim });
      chartData = dias.map((dia) => {
        const count = agendamentos.filter(
          (a) => format(new Date(a.dataHora), "yyyy-MM-dd") === format(dia, "yyyy-MM-dd")
        ).length;
        return {
          name: format(dia, "dd/MM", { locale: ptBR }),
          agendamentos: count,
        };
      });
    } else if (diasDiferenca <= 90) {
      // Agrupa por semana
      const semanas = eachWeekOfInterval({ start: inicio, end: fim }, { weekStartsOn: 0 });
      chartData = semanas.map((semana, index) => {
        const proximaSemana = semanas[index + 1] || fim;
        const count = agendamentos.filter((a) => {
          const data = new Date(a.dataHora);
          return data >= semana && data < proximaSemana;
        }).length;
        return {
          name: `Sem ${format(semana, "dd/MM")}`,
          agendamentos: count,
        };
      });
    } else {
      // Agrupa por mês
      const meses = eachMonthOfInterval({ start: inicio, end: fim });
      chartData = meses.map((mes) => {
        const count = agendamentos.filter(
          (a) => format(new Date(a.dataHora), "yyyy-MM") === format(mes, "yyyy-MM")
        ).length;
        return {
          name: format(mes, "MMM/yy", { locale: ptBR }),
          agendamentos: count,
        };
      });
    }

    return NextResponse.json({
      chartData,
      tiposData,
      total: agendamentos.length,
    });
  } catch (error) {
    console.error("Erro ao buscar dados do gráfico:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

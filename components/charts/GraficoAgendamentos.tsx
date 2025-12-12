"use client";

import { useState, useEffect } from "react";
import { format, subDays, subMonths, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartData {
  name: string;
  agendamentos: number;
}

type PeriodoType = "semana" | "mes" | "ano" | "personalizado";

export function GraficoAgendamentos() {
  const [periodo, setPeriodo] = useState<PeriodoType>("semana");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(subDays(new Date(), 7));
  const [dataFim, setDataFim] = useState<Date | undefined>(new Date());
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [periodo, dataInicio, dataFim]);

  function getDateRange(): { inicio: Date; fim: Date } {
    const hoje = new Date();
    switch (periodo) {
      case "semana":
        return { inicio: subDays(hoje, 7), fim: hoje };
      case "mes":
        return { inicio: subMonths(hoje, 1), fim: hoje };
      case "ano":
        return { inicio: subYears(hoje, 1), fim: hoje };
      case "personalizado":
        return {
          inicio: dataInicio || subDays(hoje, 7),
          fim: dataFim || hoje,
        };
      default:
        return { inicio: subDays(hoje, 7), fim: hoje };
    }
  }

  async function fetchData() {
    setLoading(true);
    try {
      const { inicio, fim } = getDateRange();
      const response = await fetch(
        `/api/stats/grafico?inicio=${inicio.toISOString()}&fim=${fim.toISOString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setChartData(data.chartData || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Erro ao carregar dados do gráfico:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Período</Label>
          <Select value={periodo} onValueChange={(v: PeriodoType) => setPeriodo(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Última Semana</SelectItem>
              <SelectItem value="mes">Último Mês</SelectItem>
              <SelectItem value="ano">Último Ano</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {periodo === "personalizado" && (
          <>
            <div className="space-y-2">
              <Label>Data Início</Label>
              <DatePicker
                date={dataInicio}
                onSelect={setDataInicio}
                placeholder="Início"
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <DatePicker
                date={dataFim}
                onSelect={setDataFim}
                placeholder="Fim"
              />
            </div>
          </>
        )}

        <div className="ml-auto text-right">
          <p className="text-sm text-muted-foreground">Total no período</p>
          <p className="text-2xl font-bold text-primary">{total}</p>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              width={70}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
              formatter={(value: number) => [`${value} agendamento(s)`, "Total"]}
            />
            <Bar
              dataKey="agendamentos"
              fill="#2563EB"
              radius={[0, 4, 4, 0]}
              maxBarSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          Nenhum agendamento encontrado no período selecionado
        </div>
      )}
    </div>
  );
}

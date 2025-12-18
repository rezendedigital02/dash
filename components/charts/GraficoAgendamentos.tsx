"use client";

import { useState, useEffect } from "react";
import { format, subDays, subMonths, subYears, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
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
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, PieChart as PieChartIcon, Calendar, Users } from "lucide-react";

interface ChartData {
  name: string;
  agendamentos: number;
  data?: string;
}

interface TipoData {
  name: string;
  value: number;
}

type PeriodoType = "semana" | "mes" | "ano" | "personalizado";
type ChartType = "area" | "bar" | "pie";

const CORES = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 shadow-lg rounded-lg border">
        <p className="font-medium text-gray-900">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function GraficoAgendamentos() {
  const [periodo, setPeriodo] = useState<PeriodoType>("semana");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(subDays(new Date(), 7));
  const [dataFim, setDataFim] = useState<Date | undefined>(new Date());
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [tiposData, setTiposData] = useState<TipoData[]>([]);
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
        setTiposData(data.tiposData || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Erro ao carregar dados do gráfico:", error);
    } finally {
      setLoading(false);
    }
  }

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Nenhum agendamento encontrado</p>
            <p className="text-sm text-gray-400">no período selecionado</p>
          </div>
        </div>
      );
    }

    switch (chartType) {
      case "area":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAgendamentos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#6B7280" }}
                tickLine={false}
                axisLine={{ stroke: "#E5E7EB" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#6B7280" }}
                tickLine={false}
                axisLine={{ stroke: "#E5E7EB" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="agendamentos"
                name="Agendamentos"
                stroke="#2563EB"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAgendamentos)"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#1D4ED8" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#6B7280" }}
                tickLine={false}
                axisLine={{ stroke: "#E5E7EB" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#6B7280" }}
                tickLine={false}
                axisLine={{ stroke: "#E5E7EB" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="agendamentos"
                name="Agendamentos"
                fill="url(#barGradient)"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tiposData.length > 0 ? tiposData : [{ name: "Sem dados", value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) =>
                    tiposData.length > 0 ? `${name} (${(percent * 100).toFixed(0)}%)` : ""
                  }
                  labelLine={tiposData.length > 0}
                >
                  {(tiposData.length > 0 ? tiposData : [{ name: "Sem dados", value: 1 }]).map(
                    (entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={tiposData.length > 0 ? CORES[index % CORES.length] : "#E5E7EB"}
                      />
                    )
                  )}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} agendamento(s)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            {tiposData.length > 0 && (
              <div className="space-y-2 min-w-[150px]">
                {tiposData.map((tipo, index) => (
                  <div key={tipo.name} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: CORES[index % CORES.length] }}
                    />
                    <span className="text-sm text-gray-600">{tipo.name}</span>
                    <span className="text-sm font-bold ml-auto">{tipo.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Tipo de Gráfico */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          <Button
            variant={chartType === "area" ? "default" : "ghost"}
            size="sm"
            onClick={() => setChartType("area")}
            className="h-8 px-3"
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Linha</span>
          </Button>
          <Button
            variant={chartType === "bar" ? "default" : "ghost"}
            size="sm"
            onClick={() => setChartType("bar")}
            className="h-8 px-3"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Barras</span>
          </Button>
          <Button
            variant={chartType === "pie" ? "default" : "ghost"}
            size="sm"
            onClick={() => setChartType("pie")}
            className="h-8 px-3"
          >
            <PieChartIcon className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Pizza</span>
          </Button>
        </div>

        {/* Período */}
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Período</Label>
          <Select value={periodo} onValueChange={(v: PeriodoType) => setPeriodo(v)}>
            <SelectTrigger className="w-[140px] h-9">
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
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Início</Label>
              <DatePicker date={dataInicio} onSelect={setDataInicio} placeholder="Início" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Fim</Label>
              <DatePicker date={dataFim} onSelect={setDataFim} placeholder="Fim" />
            </div>
          </>
        )}

        {/* Totais */}
        <div className="ml-auto flex gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Total no período</p>
            <div className="flex items-center gap-2 justify-end">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold text-primary">{total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-4">{renderChart()}</div>
      )}

      {/* Legenda de Datas */}
      {!loading && chartData.length > 0 && chartType !== "pie" && (
        <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-primary rounded" />
            <span>Agendamentos por dia</span>
          </div>
          <div>
            {format(getDateRange().inicio, "dd/MM/yyyy")} -{" "}
            {format(getDateRange().fim, "dd/MM/yyyy")}
          </div>
        </div>
      )}
    </div>
  );
}

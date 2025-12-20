"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, Lock, LogOut, Plus, ChevronLeft, ChevronRight, BarChart3, Menu, X, Phone, Link2, RefreshCw, User, Mail, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ModalAgendar } from "@/components/modals/ModalAgendar";
import { ModalBloquear } from "@/components/modals/ModalBloquear";
import { GraficoAgendamentos } from "@/components/charts/GraficoAgendamentos";

interface Agendamento {
  id: string;
  pacienteNome: string;
  pacienteTelefone: string;
  pacienteEmail?: string;
  dataHora: string;
  tipo: string;
  observacoes?: string;
  origem: string;
  status: string;
}

interface Bloqueio {
  id: string;
  tipo: string;
  data: string;
  horaInicio?: string;
  horaFim?: string;
  motivo?: string;
  ativo: boolean;
}

interface Stats {
  agendamentosHoje: number;
  totalSemana: number;
  bloqueiosAtivos: number;
}

interface UserInfo {
  clinica: string;
  nome: string;
}

const HORARIOS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00"
];

const TIPOS_CONSULTA: Record<string, string> = {
  consulta: "Consulta",
  retorno: "Retorno",
  procedimento: "Procedimento",
  avaliacao: "Avaliação",
  emergencia: "Emergência",
};

export default function DashboardPage() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalAgendarOpen, setModalAgendarOpen] = useState(false);
  const [modalBloquearOpen, setModalBloquearOpen] = useState(false);
  const [showGrafico, setShowGrafico] = useState(false);
  const [selectedHorario, setSelectedHorario] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [importingGoogle, setImportingGoogle] = useState(false);

  // Verifica status do Google Calendar e auto-sincroniza
  const checkGoogleStatus = useCallback(async () => {
    console.log("[Dashboard] Verificando status do Google Calendar...");
    try {
      const res = await fetch("/api/google/status");
      if (res.ok) {
        const data = await res.json();
        setGoogleConnected(data.connected);
        console.log("[Dashboard] Google Calendar conectado:", data.connected);

        // Se estiver conectado, faz auto-import silencioso
        if (data.connected) {
          console.log("[Dashboard] Iniciando auto-import do Google Calendar...");
          try {
            const importRes = await fetch("/api/google/import", { method: "POST" });
            if (importRes.ok) {
              const importData = await importRes.json();
              console.log("[Dashboard] Auto-import concluído:", importData);
              if (importData.imported > 0) {
                console.log(`[Dashboard] ${importData.imported} novos eventos importados`);
              }
            } else {
              console.error("[Dashboard] Erro no auto-import:", await importRes.text());
            }
          } catch (importError) {
            console.error("[Dashboard] Erro ao fazer auto-import:", importError);
          }
        }
      }
    } catch (error) {
      console.error("[Dashboard] Erro ao verificar Google:", error);
    }
  }, []);

  // Conecta ao Google Calendar
  async function handleConnectGoogle() {
    try {
      const res = await fetch("/api/google/auth");
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Erro ao conectar Google:", error);
      alert("Erro ao conectar com Google Calendar");
    }
  }

  // Sincroniza agendamentos locais com Google Calendar
  async function handleSyncGoogle() {
    setSyncingGoogle(true);
    try {
      const res = await fetch("/api/google/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const msgs = [];
        if (data.syncedAgendamentos > 0) {
          msgs.push(`${data.syncedAgendamentos} agendamento(s)`);
        }
        if (data.syncedBloqueios > 0) {
          msgs.push(`${data.syncedBloqueios} bloqueio(s)`);
        }
        if (msgs.length > 0) {
          alert(`Sincronizado com sucesso!\n\n${msgs.join(" e ")} enviado(s) para o Google Calendar.`);
        } else {
          alert("Tudo já estava sincronizado!");
        }
        fetchData();
      } else {
        alert(data.error || "Erro ao sincronizar");
      }
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      alert("Erro ao sincronizar com Google Calendar");
    } finally {
      setSyncingGoogle(false);
    }
  }

  // Importa eventos do Google Calendar para o banco
  async function handleImportGoogle() {
    setImportingGoogle(true);
    try {
      const res = await fetch("/api/google/import", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(`Importado! ${data.imported} eventos do Google Calendar.`);
        fetchData();
      } else {
        alert(data.error || "Erro ao importar");
      }
    } catch (error) {
      console.error("Erro ao importar:", error);
      alert("Erro ao importar do Google Calendar");
    } finally {
      setImportingGoogle(false);
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const [agendRes, bloqRes, statsRes, userRes] = await Promise.all([
        fetch(`/api/agendamentos?data=${dateStr}`),
        fetch("/api/bloqueios"),
        fetch("/api/stats"),
        fetch("/api/auth/me"),
      ]);

      if (agendRes.ok) {
        const data = await agendRes.json();
        setAgendamentos(data);
      }
      if (bloqRes.ok) {
        const data = await bloqRes.json();
        setBloqueios(data);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      if (userRes.ok) {
        const data = await userRes.json();
        setUserInfo(data);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    console.log("[Dashboard] useEffect - Iniciando carregamento...");

    // Função assíncrona para carregar dados na ordem correta
    const loadDashboard = async () => {
      // Primeiro verifica Google e faz auto-import
      await checkGoogleStatus();
      // Depois carrega os dados (incluindo os recém-importados)
      await fetchData();
    };

    loadDashboard();
  }, [fetchData, checkGoogleStatus]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleRemoverBloqueio(id: string) {
    console.log("[Dashboard] Removendo bloqueio:", id);
    try {
      const response = await fetch(`/api/bloqueios/${id}`, { method: "DELETE" });
      console.log("[Dashboard] Resposta remover bloqueio:", response.status);
      if (response.ok) {
        fetchData();
      } else {
        const data = await response.json();
        console.error("[Dashboard] Erro ao remover bloqueio:", data);
        alert(data.error || "Erro ao remover bloqueio");
      }
    } catch (error) {
      console.error("[Dashboard] Erro ao remover bloqueio:", error);
      alert("Erro ao remover bloqueio");
    }
  }

  async function handleCancelarAgendamento(id: string, pacienteNome: string) {
    console.log("[Dashboard] Cancelando agendamento:", id);
    if (!confirm(`Tem certeza que deseja cancelar o agendamento de ${pacienteNome}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/agendamentos/${id}`, { method: "DELETE" });
      console.log("[Dashboard] Resposta cancelar agendamento:", response.status);
      if (response.ok) {
        alert("Agendamento cancelado com sucesso!");
        fetchData();
      } else {
        const data = await response.json();
        console.error("[Dashboard] Erro ao cancelar agendamento:", data);
        alert(data.error || "Erro ao cancelar agendamento");
      }
    } catch (error) {
      console.error("[Dashboard] Erro ao cancelar agendamento:", error);
      alert("Erro ao cancelar agendamento");
    }
  }

  function getHorarioStatus(horario: string) {
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const bloqueioInteiro = bloqueios.find(
      (b) => b.ativo && b.tipo === "dia_inteiro" && format(new Date(b.data), "yyyy-MM-dd") === dateStr
    );
    if (bloqueioInteiro) {
      return { status: "bloqueado", data: bloqueioInteiro };
    }

    const bloqueioHorario = bloqueios.find((b) => {
      if (!b.ativo || b.tipo !== "horario") return false;
      const bloqDate = format(new Date(b.data), "yyyy-MM-dd");
      if (bloqDate !== dateStr) return false;
      if (b.horaInicio && b.horaFim) {
        return horario >= b.horaInicio && horario < b.horaFim;
      }
      return false;
    });
    if (bloqueioHorario) {
      return { status: "bloqueado", data: bloqueioHorario };
    }

    const agendamento = agendamentos.find((a) => {
      const agendHora = format(new Date(a.dataHora), "HH:mm");
      return agendHora === horario && a.status === "confirmado";
    });
    if (agendamento) {
      return { status: "confirmado", data: agendamento };
    }

    return { status: "livre", data: null };
  }

  function isDayBlocked(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd");
    return bloqueios.some(
      (b) => b.ativo && format(new Date(b.data), "yyyy-MM-dd") === dateStr
    );
  }

  function renderCalendar() {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const isBlocked = isDayBlocked(cloneDay);
        const isSelected = isSameDay(cloneDay, selectedDate);
        const isTodayDate = isToday(cloneDay);
        const isCurrentMonth = isSameMonth(cloneDay, currentMonth);

        days.push(
          <button
            key={day.toString()}
            onClick={() => {
              setSelectedDate(cloneDay);
              setShowCalendar(false);
            }}
            className={`
              p-1.5 sm:p-2 text-xs sm:text-sm rounded-md transition-colors relative min-w-[36px] min-h-[36px]
              ${!isCurrentMonth ? "text-gray-300" : "text-gray-700"}
              ${isSelected ? "bg-primary text-white" : "hover:bg-gray-100 active:bg-gray-200"}
              ${isTodayDate && !isSelected ? "ring-2 ring-primary" : ""}
              ${isBlocked && isCurrentMonth ? "bg-red-100" : ""}
            `}
          >
            {format(day, "d")}
            {isBlocked && isCurrentMonth && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full" />
            )}
          </button>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {days}
        </div>
      );
      days = [];
    }

    return rows;
  }

  function openAgendarModal(horario: string) {
    setSelectedHorario(horario);
    setModalAgendarOpen(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          <Skeleton className="h-14 sm:h-16 w-full" />
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <Skeleton className="h-20 sm:h-32" />
            <Skeleton className="h-20 sm:h-32" />
            <Skeleton className="h-20 sm:h-32" />
          </div>
          <Skeleton className="h-64 sm:h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Mobile */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                {userInfo?.clinica || "Clínica"}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                Olá, {userInfo?.nome?.split(" ")[0] || "Usuário"}
              </p>
            </div>

            {/* Desktop buttons */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-3">
              {!googleConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectGoogle}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Conectar Google
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImportGoogle}
                    disabled={importingGoogle}
                    className="text-green-600 border-green-300 hover:bg-green-50"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${importingGoogle ? "animate-spin" : ""}`} />
                    {importingGoogle ? "Importando..." : "Importar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncGoogle}
                    disabled={syncingGoogle}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncingGoogle ? "animate-spin" : ""}`} />
                    {syncingGoogle ? "Sincronizando..." : "Sincronizar"}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGrafico(!showGrafico)}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                {showGrafico ? "Ocultar" : "Gráfico"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              className="sm:hidden p-2 rounded-md hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile menu dropdown */}
          {mobileMenuOpen && (
            <div className="sm:hidden mt-3 pt-3 border-t space-y-2">
              {!googleConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-blue-600"
                  onClick={() => {
                    handleConnectGoogle();
                    setMobileMenuOpen(false);
                  }}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Conectar Google Calendar
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-green-600"
                    onClick={() => {
                      handleImportGoogle();
                      setMobileMenuOpen(false);
                    }}
                    disabled={importingGoogle}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${importingGoogle ? "animate-spin" : ""}`} />
                    Importar do Google
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      handleSyncGoogle();
                      setMobileMenuOpen(false);
                    }}
                    disabled={syncingGoogle}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncingGoogle ? "animate-spin" : ""}`} />
                    Sincronizar com Google
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setShowGrafico(!showGrafico);
                  setMobileMenuOpen(false);
                }}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                {showGrafico ? "Ocultar Gráfico" : "Ver Gráfico"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-red-600 hover:text-red-700"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Stats Cards - Compactos no mobile */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-blue-100 text-[10px] sm:text-sm font-medium">Hoje</p>
                  <p className="text-xl sm:text-3xl font-bold">{stats?.agendamentosHoje || 0}</p>
                </div>
                <CalendarDays className="hidden sm:block h-10 w-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-emerald-100 text-[10px] sm:text-sm font-medium">Semana</p>
                  <p className="text-xl sm:text-3xl font-bold">{stats?.totalSemana || 0}</p>
                </div>
                <Clock className="hidden sm:block h-10 w-10 text-emerald-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-red-100 text-[10px] sm:text-sm font-medium">Bloqueios</p>
                  <p className="text-xl sm:text-3xl font-bold">{stats?.bloqueiosAtivos || 0}</p>
                </div>
                <Lock className="hidden sm:block h-10 w-10 text-red-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico (toggle) */}
        {showGrafico && (
          <Card>
            <CardHeader className="pb-2 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Gráfico de Agendamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <GraficoAgendamentos />
            </CardContent>
          </Card>
        )}

        {/* Consultas do Dia */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Consultas do Dia - {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
              </CardTitle>
              <Badge variant={agendamentos.length > 0 ? "default" : "secondary"}>
                {agendamentos.length} {agendamentos.length === 1 ? "consulta" : "consultas"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {agendamentos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Nenhuma consulta agendada para este dia</p>
                <p className="text-xs text-gray-400 mt-1">Selecione um horário para agendar</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {agendamentos
                  .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
                  .map((agendamento) => (
                    <div
                      key={agendamento.id}
                      className="p-4 rounded-lg border bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <Badge
                          variant={agendamento.origem === "manual" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {TIPOS_CONSULTA[agendamento.tipo] || agendamento.tipo}
                        </Badge>
                        <span className="text-lg font-bold text-primary">
                          {format(new Date(agendamento.dataHora), "HH:mm")}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-sm truncate">
                            {agendamento.pacienteNome}
                          </span>
                        </div>

                        <a
                          href={`tel:${agendamento.pacienteTelefone}`}
                          className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors"
                        >
                          <Phone className="h-4 w-4 text-gray-400" />
                          {agendamento.pacienteTelefone}
                        </a>

                        {agendamento.pacienteEmail && (
                          <a
                            href={`mailto:${agendamento.pacienteEmail}`}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors truncate"
                          >
                            <Mail className="h-4 w-4 text-gray-400" />
                            {agendamento.pacienteEmail}
                          </a>
                        )}

                        {agendamento.observacoes && (
                          <div className="flex items-start gap-2 text-sm text-gray-500 pt-2 border-t">
                            <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{agendamento.observacoes}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          {agendamento.origem === "manual" ? "Agendado manualmente" : "Via WhatsApp"}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={agendamento.status === "confirmado" ? "success" : "secondary"}
                            className="text-xs"
                          >
                            {agendamento.status}
                          </Badge>
                          {agendamento.status === "confirmado" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleCancelarAgendamento(agendamento.id, agendamento.pacienteNome)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data selecionada e botão calendário (mobile) */}
        <div className="flex items-center justify-between sm:hidden">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center gap-2 text-lg font-semibold text-gray-900"
          >
            <CalendarDays className="h-5 w-5 text-primary" />
            {format(selectedDate, "dd MMM yyyy", { locale: ptBR })}
            <ChevronRight className={`h-4 w-4 transition-transform ${showCalendar ? "rotate-90" : ""}`} />
          </button>
          <Button onClick={() => setModalBloquearOpen(true)} variant="destructive" size="sm">
            <Lock className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendário Mobile (collapsible) */}
        {showCalendar && (
          <Card className="sm:hidden">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((day, i) => (
                  <div key={i} className="text-center text-xs font-medium text-gray-500 p-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="space-y-0.5">{renderCalendar()}</div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Calendário Desktop */}
          <Card className="hidden sm:block">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 p-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="space-y-1">{renderCalendar()}</div>
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-primary rounded" />
                  <span>Selecionado</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-100 rounded border border-red-300" />
                  <span>Bloqueado</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horários do Dia */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 sm:pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg">
                  <span className="hidden sm:inline">Horários - </span>
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </CardTitle>
                <Button
                  onClick={() => setModalBloquearOpen(true)}
                  variant="destructive"
                  size="sm"
                  className="hidden sm:flex"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Bloquear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="space-y-2 max-h-[60vh] sm:max-h-[500px] overflow-y-auto">
                {HORARIOS.map((horario) => {
                  const { status, data } = getHorarioStatus(horario);

                  return (
                    <div
                      key={horario}
                      className={`
                        flex items-center justify-between p-2.5 sm:p-3 rounded-lg border transition-colors
                        ${status === "confirmado" ? "bg-emerald-50 border-emerald-200" : ""}
                        ${status === "bloqueado" ? "bg-red-50 border-red-200" : ""}
                        ${status === "livre" ? "bg-gray-50 border-gray-200 hover:bg-gray-100 active:bg-gray-200" : ""}
                      `}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <span className="font-mono text-xs sm:text-sm font-medium w-10 sm:w-12 flex-shrink-0">
                          {horario}
                        </span>
                        {status === "confirmado" && data && (
                          <div className="min-w-0 flex-1 flex items-center justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                <Badge variant="success" className="text-[10px] sm:text-xs">
                                  {TIPOS_CONSULTA[(data as Agendamento).tipo] || (data as Agendamento).tipo}
                                </Badge>
                                <span className="font-medium text-xs sm:text-sm truncate">
                                  {(data as Agendamento).pacienteNome}
                                </span>
                              </div>
                              <a
                                href={`tel:${(data as Agendamento).pacienteTelefone}`}
                                className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 hover:text-primary"
                              >
                                <Phone className="h-3 w-3" />
                                {(data as Agendamento).pacienteTelefone}
                              </a>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                              onClick={() => handleCancelarAgendamento((data as Agendamento).id, (data as Agendamento).pacienteNome)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {status === "bloqueado" && data && (
                          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                            <Lock className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm text-red-600 truncate">
                              {(data as Bloqueio).motivo || "Bloqueado"}
                            </span>
                          </div>
                        )}
                        {status === "livre" && (
                          <span className="text-xs sm:text-sm text-gray-400">Disponível</span>
                        )}
                      </div>
                      {status === "livre" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 sm:px-3 flex-shrink-0"
                          onClick={() => openAgendarModal(horario)}
                        >
                          <Plus className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Agendar</span>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Bloqueios Ativos */}
        {bloqueios.filter((b) => b.ativo).length > 0 && (
          <Card>
            <CardHeader className="pb-2 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Bloqueios Ativos</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="space-y-2">
                {bloqueios
                  .filter((b) => b.ativo)
                  .map((bloqueio) => (
                    <div
                      key={bloqueio.id}
                      className="flex items-center justify-between p-2.5 sm:p-3 bg-red-50 rounded-lg border border-red-200"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm">
                            {format(new Date(bloqueio.data), "dd/MM/yyyy", { locale: ptBR })}
                            {bloqueio.tipo === "horario" && bloqueio.horaInicio && bloqueio.horaFim && (
                              <span className="ml-1 sm:ml-2 text-gray-600">
                                {bloqueio.horaInicio}-{bloqueio.horaFim}
                              </span>
                            )}
                            {bloqueio.tipo === "dia_inteiro" && (
                              <Badge variant="destructive" className="ml-1 sm:ml-2 text-[10px] sm:text-xs">
                                Dia Inteiro
                              </Badge>
                            )}
                          </p>
                          {bloqueio.motivo && (
                            <p className="text-[10px] sm:text-xs text-gray-500 truncate">{bloqueio.motivo}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoverBloqueio(bloqueio.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-100 h-8 px-2 sm:px-3 flex-shrink-0"
                      >
                        <span className="hidden sm:inline">Remover</span>
                        <X className="h-4 w-4 sm:hidden" />
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Modals */}
      <ModalAgendar
        open={modalAgendarOpen}
        onOpenChange={setModalAgendarOpen}
        selectedDate={selectedDate}
        selectedHorario={selectedHorario}
        onSuccess={fetchData}
      />
      <ModalBloquear
        open={modalBloquearOpen}
        onOpenChange={setModalBloquearOpen}
        selectedDate={selectedDate}
        onSuccess={fetchData}
      />
    </div>
  );
}

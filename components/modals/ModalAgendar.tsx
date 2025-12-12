"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModalAgendarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  selectedHorario: string | null;
  onSuccess: () => void;
}

const TIPOS_CONSULTA = [
  { value: "consulta", label: "Consulta" },
  { value: "retorno", label: "Retorno" },
  { value: "procedimento", label: "Procedimento" },
  { value: "avaliacao", label: "Avaliação" },
  { value: "emergencia", label: "Emergência" },
];

const HORARIOS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00"
];

export function ModalAgendar({
  open,
  onOpenChange,
  selectedDate,
  selectedHorario,
  onSuccess,
}: ModalAgendarProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    pacienteNome: "",
    pacienteTelefone: "",
    pacienteEmail: "",
    horario: selectedHorario || "",
    tipo: "consulta",
    observacoes: "",
  });

  // Atualiza o horário quando selectedHorario muda
  useState(() => {
    if (selectedHorario) {
      setFormData((prev) => ({ ...prev, horario: selectedHorario }));
    }
  });

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  function formatPhoneInput(value: string) {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      let formatted = cleaned;
      if (cleaned.length > 2) {
        formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
      }
      if (cleaned.length > 7) {
        formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
      }
      return formatted;
    }
    return value;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validação
    if (!formData.pacienteNome.trim()) {
      setError("Nome do paciente é obrigatório");
      setLoading(false);
      return;
    }
    if (!formData.pacienteTelefone.trim()) {
      setError("Telefone do paciente é obrigatório");
      setLoading(false);
      return;
    }
    if (!formData.horario) {
      setError("Selecione um horário");
      setLoading(false);
      return;
    }

    try {
      // Monta a data/hora completa
      const [hora, minuto] = formData.horario.split(":");
      const dataHora = new Date(selectedDate);
      dataHora.setHours(parseInt(hora), parseInt(minuto), 0, 0);

      const response = await fetch("/api/agendamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pacienteNome: formData.pacienteNome,
          pacienteTelefone: formData.pacienteTelefone,
          pacienteEmail: formData.pacienteEmail || null,
          dataHora: dataHora.toISOString(),
          tipo: formData.tipo,
          observacoes: formData.observacoes || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar agendamento");
      }

      // Limpa o formulário e fecha o modal
      setFormData({
        pacienteNome: "",
        pacienteTelefone: "",
        pacienteEmail: "",
        horario: "",
        tipo: "consulta",
        observacoes: "",
      });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar agendamento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription>
            {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="pacienteNome">Nome do Paciente *</Label>
            <Input
              id="pacienteNome"
              placeholder="Nome completo"
              value={formData.pacienteNome}
              onChange={(e) => handleChange("pacienteNome", e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pacienteTelefone">Telefone *</Label>
            <Input
              id="pacienteTelefone"
              placeholder="(00) 00000-0000"
              value={formData.pacienteTelefone}
              onChange={(e) =>
                handleChange("pacienteTelefone", formatPhoneInput(e.target.value))
              }
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pacienteEmail">Email (opcional)</Label>
            <Input
              id="pacienteEmail"
              type="email"
              placeholder="email@exemplo.com"
              value={formData.pacienteEmail}
              onChange={(e) => handleChange("pacienteEmail", e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="horario">Horário *</Label>
              <Select
                value={formData.horario || selectedHorario || ""}
                onValueChange={(value) => handleChange("horario", value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {HORARIOS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Consulta</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => handleChange("tipo", value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CONSULTA.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea
              id="observacoes"
              placeholder="Informações adicionais sobre a consulta..."
              value={formData.observacoes}
              onChange={(e) => handleChange("observacoes", e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="success" disabled={loading}>
              {loading ? "Salvando..." : "Confirmar Agendamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

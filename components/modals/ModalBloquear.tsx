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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

interface ModalBloquearProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onSuccess: () => void;
}

const HORARIOS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30"
];

export function ModalBloquear({
  open,
  onOpenChange,
  selectedDate,
  onSuccess,
}: ModalBloquearProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tipo, setTipo] = useState<"horario" | "dia_inteiro">("horario");
  const [data, setData] = useState<Date | undefined>(selectedDate);
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [motivo, setMotivo] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validação
    if (!data) {
      setError("Selecione uma data");
      setLoading(false);
      return;
    }
    if (tipo === "horario" && (!horaInicio || !horaFim)) {
      setError("Selecione horário de início e fim");
      setLoading(false);
      return;
    }
    if (tipo === "horario" && horaInicio >= horaFim) {
      setError("Horário de fim deve ser maior que o de início");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/bloqueios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          data: data.toISOString(),
          horaInicio: tipo === "horario" ? horaInicio : null,
          horaFim: tipo === "horario" ? horaFim : null,
          motivo: motivo || null,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Erro ao criar bloqueio");
      }

      // Limpa o formulário e fecha o modal
      setTipo("horario");
      setData(selectedDate);
      setHoraInicio("");
      setHoraFim("");
      setMotivo("");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar bloqueio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Bloquear Horário</DialogTitle>
          <DialogDescription>
            Bloqueie um horário específico ou um dia inteiro
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Tipo de Bloqueio</Label>
            <Select
              value={tipo}
              onValueChange={(value: "horario" | "dia_inteiro") => setTipo(value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="horario">Horário Específico</SelectItem>
                <SelectItem value="dia_inteiro">Dia Inteiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <DatePicker
              date={data}
              onSelect={setData}
              placeholder="Selecione a data"
              disabled={loading}
            />
          </div>

          {tipo === "horario" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora Início</Label>
                <Select
                  value={horaInicio}
                  onValueChange={setHoraInicio}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Início" />
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
                <Label>Hora Fim</Label>
                <Select
                  value={horaFim}
                  onValueChange={setHoraFim}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Fim" />
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
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Input
              id="motivo"
              placeholder="Ex: Feriado, Reunião, Férias..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={loading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Salvando..." : "Confirmar Bloqueio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

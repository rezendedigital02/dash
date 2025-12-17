import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import { listCalendarEvents } from "@/lib/google-calendar";
import { addDays, startOfDay, endOfDay } from "date-fns";

// POST /api/google/import - Importa eventos do Google Calendar para o banco
export async function POST() {
  console.log("📥 [Google Import] Iniciando importação...");

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log("❌ [Google Import] Usuário não autenticado");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    console.log("👤 [Google Import] Usuário:", user.userId);

    const usuario = await prisma.usuario.findUnique({
      where: { id: user.userId },
      select: {
        googleCalendarId: true,
        googleRefreshToken: true,
      },
    });

    if (!usuario?.googleRefreshToken || !usuario?.googleCalendarId) {
      console.log("❌ [Google Import] Google Calendar não conectado");
      return NextResponse.json(
        { error: "Google Calendar não conectado" },
        { status: 400 }
      );
    }

    console.log("📅 [Google Import] Calendar ID:", usuario.googleCalendarId);

    // Busca eventos dos próximos 60 dias e últimos 30 dias
    const timeMin = startOfDay(addDays(new Date(), -30));
    const timeMax = endOfDay(addDays(new Date(), 60));

    console.log("📅 [Google Import] Período:", timeMin, "até", timeMax);

    const events = await listCalendarEvents(
      usuario.googleRefreshToken,
      usuario.googleCalendarId,
      timeMin,
      timeMax
    );

    console.log("📅 [Google Import] Eventos encontrados:", events.length);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const event of events) {
      try {
        // Pula eventos sem data/hora
        if (!event.start?.dateTime && !event.start?.date) {
          skipped++;
          continue;
        }

        // Pula eventos de dia inteiro (geralmente não são consultas)
        if (event.start?.date && !event.start?.dateTime) {
          console.log("⏭️ [Google Import] Pulando evento de dia inteiro:", event.summary);
          skipped++;
          continue;
        }

        // Verifica se já existe no banco (pelo googleEventId)
        const existente = await prisma.agendamento.findFirst({
          where: { googleEventId: event.id },
        });

        if (existente) {
          console.log("⏭️ [Google Import] Evento já existe:", event.id);
          skipped++;
          continue;
        }

        // Extrai informações do evento
        const summary = event.summary || "Consulta";
        const dataHora = new Date(event.start?.dateTime || event.start?.date || "");

        // Tenta extrair nome do paciente do título
        // Formatos esperados: "Consulta: Nome", "Nome - Consulta", "Nome"
        let pacienteNome = summary;
        let tipo = "consulta";

        // Tenta detectar o tipo
        const tipoPatterns = [
          { pattern: /consulta/i, tipo: "consulta" },
          { pattern: /retorno/i, tipo: "retorno" },
          { pattern: /procedimento/i, tipo: "procedimento" },
          { pattern: /avalia[çc][ãa]o/i, tipo: "avaliacao" },
          { pattern: /emerg[êe]ncia/i, tipo: "emergencia" },
        ];

        for (const { pattern, tipo: t } of tipoPatterns) {
          if (pattern.test(summary)) {
            tipo = t;
            // Remove o tipo do nome
            pacienteNome = summary.replace(pattern, "").replace(/[-:]/g, "").trim();
            break;
          }
        }

        // Limpa o nome
        pacienteNome = pacienteNome.trim() || "Paciente (importado)";

        console.log("📥 [Google Import] Importando:", {
          summary,
          pacienteNome,
          tipo,
          dataHora,
          googleEventId: event.id,
        });

        // Cria o agendamento no banco
        await prisma.agendamento.create({
          data: {
            usuarioId: user.userId,
            pacienteNome,
            pacienteTelefone: "", // Não temos essa info do Calendar
            pacienteEmail: event.attendees?.[0]?.email || null,
            dataHora,
            tipo,
            observacoes: event.description || null,
            origem: "agente_ia", // Marca como vindo de fora
            status: "confirmado",
            googleEventId: event.id,
          },
        });

        imported++;
        console.log("✅ [Google Import] Evento importado:", event.id);
      } catch (eventError) {
        console.error("❌ [Google Import] Erro ao importar evento:", event.id, eventError);
        errors++;
      }
    }

    console.log("📥 [Google Import] Resultado:", { imported, skipped, errors });

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      total: events.length,
    });
  } catch (error) {
    console.error("❌ [Google Import] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao importar eventos" },
      { status: 500 }
    );
  }
}

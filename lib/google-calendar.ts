import { google, calendar_v3 } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

// Cria cliente OAuth2
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
  );
}

// Gera URL de autorização
export function getAuthUrl() {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

// Troca código por tokens
export async function getTokensFromCode(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Cria cliente autenticado com refresh token
export function getAuthenticatedClient(refreshToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

// Obtém instância do Calendar
export function getCalendarClient(refreshToken: string) {
  const auth = getAuthenticatedClient(refreshToken);
  return google.calendar({ version: "v3", auth });
}

// Lista calendários do usuário
export async function listCalendars(refreshToken: string) {
  const calendar = getCalendarClient(refreshToken);
  const response = await calendar.calendarList.list();
  return response.data.items || [];
}

// Cria evento no Google Calendar
export async function createCalendarEvent(
  refreshToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    startDateTime: Date;
    endDateTime: Date;
    attendees?: { email: string }[];
    isAllDay?: boolean;
  }
) {
  console.log("[createCalendarEvent] Iniciando criação de evento...");
  console.log("[createCalendarEvent] Calendar ID:", calendarId);
  console.log("[createCalendarEvent] Evento:", JSON.stringify({
    summary: event.summary,
    startDateTime: event.startDateTime.toISOString(),
    endDateTime: event.endDateTime.toISOString(),
    isAllDay: event.isAllDay,
  }, null, 2));

  const calendar = getCalendarClient(refreshToken);

  let eventData: calendar_v3.Schema$Event;

  if (event.isAllDay) {
    // Evento de dia inteiro usa formato 'date' (YYYY-MM-DD)
    const startDate = event.startDateTime.toISOString().split("T")[0];
    const endDate = event.endDateTime.toISOString().split("T")[0];

    console.log("[createCalendarEvent] Evento de dia inteiro:");
    console.log("[createCalendarEvent] - Start date:", startDate);
    console.log("[createCalendarEvent] - End date:", endDate);

    eventData = {
      summary: event.summary,
      description: event.description,
      start: {
        date: startDate,
        timeZone: "America/Sao_Paulo",
      },
      end: {
        date: endDate,
        timeZone: "America/Sao_Paulo",
      },
      transparency: "opaque", // Marca como "ocupado" no calendário
      reminders: {
        useDefault: false,
        overrides: [],
      },
    };
  } else {
    // Evento com horário específico usa formato 'dateTime'
    console.log("[createCalendarEvent] Evento com horário específico:");
    console.log("[createCalendarEvent] - Start dateTime:", event.startDateTime.toISOString());
    console.log("[createCalendarEvent] - End dateTime:", event.endDateTime.toISOString());

    eventData = {
      summary: event.summary,
      description: event.description,
      start: {
        dateTime: event.startDateTime.toISOString(),
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: event.endDateTime.toISOString(),
        timeZone: "America/Sao_Paulo",
      },
      attendees: event.attendees,
      transparency: "opaque", // Marca como "ocupado" no calendário
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
          { method: "email", minutes: 60 },
        ],
      },
    };
  }

  console.log("[createCalendarEvent] EventData final:", JSON.stringify(eventData, null, 2));

  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventData,
    sendUpdates: "all",
  });

  console.log("[createCalendarEvent] Evento criado com sucesso. ID:", response.data.id);

  return response.data;
}

// Atualiza evento no Google Calendar
export async function updateCalendarEvent(
  refreshToken: string,
  calendarId: string,
  eventId: string,
  event: {
    summary?: string;
    description?: string;
    startDateTime?: Date;
    endDateTime?: Date;
  }
) {
  const calendar = getCalendarClient(refreshToken);

  const eventData: calendar_v3.Schema$Event = {};

  if (event.summary) eventData.summary = event.summary;
  if (event.description) eventData.description = event.description;
  if (event.startDateTime) {
    eventData.start = {
      dateTime: event.startDateTime.toISOString(),
      timeZone: "America/Sao_Paulo",
    };
  }
  if (event.endDateTime) {
    eventData.end = {
      dateTime: event.endDateTime.toISOString(),
      timeZone: "America/Sao_Paulo",
    };
  }

  const response = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: eventData,
    sendUpdates: "all",
  });

  return response.data;
}

// Remove evento do Google Calendar
export async function deleteCalendarEvent(
  refreshToken: string,
  calendarId: string,
  eventId: string
) {
  const calendar = getCalendarClient(refreshToken);

  await calendar.events.delete({
    calendarId,
    eventId,
    sendUpdates: "all",
  });
}

// Lista eventos do calendário em um período
export async function listCalendarEvents(
  refreshToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
) {
  const calendar = getCalendarClient(refreshToken);

  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return response.data.items || [];
}

// Formata agendamento para evento do Google Calendar
export function formatAgendamentoToEvent(agendamento: {
  pacienteNome: string;
  pacienteTelefone: string;
  pacienteEmail?: string | null;
  tipo: string;
  observacoes?: string | null;
  dataHora: Date;
}) {
  const tiposLabel: Record<string, string> = {
    consulta: "Consulta",
    retorno: "Retorno",
    procedimento: "Procedimento",
    avaliacao: "Avaliação",
    emergencia: "Emergência",
  };

  const endDateTime = new Date(agendamento.dataHora);
  endDateTime.setMinutes(endDateTime.getMinutes() + 30); // Duração padrão: 30 min

  return {
    summary: `${tiposLabel[agendamento.tipo] || agendamento.tipo} - ${agendamento.pacienteNome}`,
    description: [
      `Paciente: ${agendamento.pacienteNome}`,
      `Telefone: ${agendamento.pacienteTelefone}`,
      agendamento.pacienteEmail ? `Email: ${agendamento.pacienteEmail}` : null,
      agendamento.observacoes ? `\nObservações: ${agendamento.observacoes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    startDateTime: agendamento.dataHora,
    endDateTime,
    attendees: agendamento.pacienteEmail ? [{ email: agendamento.pacienteEmail }] : undefined,
  };
}

// Formata bloqueio para evento do Google Calendar
export function formatBloqueioToEvent(bloqueio: {
  tipo: string;
  data: Date;
  horaInicio?: string | null;
  horaFim?: string | null;
  motivo?: string | null;
}) {
  console.log("[formatBloqueioToEvent] Iniciando formatação de bloqueio...");
  console.log("[formatBloqueioToEvent] Dados recebidos:", JSON.stringify({
    tipo: bloqueio.tipo,
    data: bloqueio.data,
    horaInicio: bloqueio.horaInicio,
    horaFim: bloqueio.horaFim,
    motivo: bloqueio.motivo,
  }, null, 2));

  let startDateTime: Date;
  let endDateTime: Date;

  // Cria uma data base no timezone correto
  const dataBase = new Date(bloqueio.data);
  console.log("[formatBloqueioToEvent] Data base:", dataBase.toISOString());

  // Extrai ano, mês e dia da data base
  const ano = dataBase.getFullYear();
  const mes = dataBase.getMonth();
  const dia = dataBase.getDate();

  if (bloqueio.tipo === "dia_inteiro") {
    // Para bloqueio de dia inteiro, cria evento das 08:00 às 18:00 (horário de São Paulo)
    // Compensa o fuso horário GMT-3 adicionando 3 horas ao UTC
    startDateTime = new Date(Date.UTC(ano, mes, dia, 11, 0, 0)); // 08:00 BRT = 11:00 UTC
    endDateTime = new Date(Date.UTC(ano, mes, dia, 21, 0, 0));   // 18:00 BRT = 21:00 UTC

    console.log("[formatBloqueioToEvent] Bloqueio dia inteiro (08:00-18:00 BRT):");
    console.log("[formatBloqueioToEvent] - Start:", startDateTime.toISOString());
    console.log("[formatBloqueioToEvent] - End:", endDateTime.toISOString());
  } else {
    // Para bloqueio de horário específico
    const [horaIni, minIni] = (bloqueio.horaInicio || "08:00").split(":").map(Number);
    const [horaFim, minFim] = (bloqueio.horaFim || "18:00").split(":").map(Number);

    console.log("[formatBloqueioToEvent] Horário específico - Início:", horaIni, ":", minIni);
    console.log("[formatBloqueioToEvent] Horário específico - Fim:", horaFim, ":", minFim);

    // Compensa o fuso horário GMT-3 (adiciona 3 horas ao UTC)
    startDateTime = new Date(Date.UTC(ano, mes, dia, horaIni + 3, minIni, 0));
    endDateTime = new Date(Date.UTC(ano, mes, dia, horaFim + 3, minFim, 0));

    console.log("[formatBloqueioToEvent] Bloqueio horário específico (BRT):");
    console.log("[formatBloqueioToEvent] - Start:", startDateTime.toISOString());
    console.log("[formatBloqueioToEvent] - End:", endDateTime.toISOString());
  }

  const motivo = bloqueio.motivo || (bloqueio.tipo === "dia_inteiro" ? "Dia bloqueado" : "Horário bloqueado");

  const result = {
    summary: `🔒 BLOQUEADO - ${motivo}`,
    description: [
      `Tipo: ${bloqueio.tipo === "dia_inteiro" ? "Dia Inteiro" : "Horário Específico"}`,
      bloqueio.motivo ? `Motivo: ${bloqueio.motivo}` : null,
      "",
      "⚠️ Este horário está bloqueado para agendamentos.",
    ]
      .filter(Boolean)
      .join("\n"),
    startDateTime,
    endDateTime,
    isAllDay: false, // Sempre false para que apareça como evento com horário
  };

  console.log("[formatBloqueioToEvent] Resultado formatado:", JSON.stringify({
    summary: result.summary,
    startDateTime: result.startDateTime.toISOString(),
    endDateTime: result.endDateTime.toISOString(),
    isAllDay: result.isAllDay,
  }, null, 2));

  return result;
}

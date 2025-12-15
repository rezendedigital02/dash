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
  }
) {
  const calendar = getCalendarClient(refreshToken);

  const eventData: calendar_v3.Schema$Event = {
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
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "email", minutes: 60 },
      ],
    },
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventData,
    sendUpdates: "all",
  });

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

# Clínica Agenda - Sistema de Gestão de Agenda

Sistema web para gestão de agenda de clínicas médicas, integrado com agentes de IA no WhatsApp.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Shadcn/ui**
- **Prisma ORM**
- **PostgreSQL**
- **JWT** para autenticação

## Funcionalidades

- Autenticação com email e senha
- Dashboard com estatísticas
- Calendário mensal visual
- Lista de horários do dia (Confirmado, Bloqueado, Livre)
- Criar agendamento manual
- Bloquear horários/dias
- Gráfico de agendamentos por período
- Webhooks para integração com n8n

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e configure:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/clinica_agenda"
JWT_SECRET="sua-chave-secreta-aqui"
```

### 3. Criar banco de dados

```bash
# Gera o client do Prisma
npm run db:generate

# Aplica as migrations
npm run db:push
```

### 4. Popular com dados de teste (opcional)

```bash
npx tsx prisma/seed.ts
```

**Credenciais de teste:**
- Email: admin@clinica.com
- Senha: 123456

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

## Estrutura do Projeto

```
/app
  /(auth)
    /login          # Página de login
  /(dashboard)
    /dashboard      # Dashboard principal
  /api
    /auth           # APIs de autenticação
    /agendamentos   # CRUD de agendamentos
    /bloqueios      # CRUD de bloqueios
    /stats          # Estatísticas
    /webhooks       # Webhooks para n8n
/components
  /ui               # Componentes Shadcn/ui
  /modals           # Modais de agendamento e bloqueio
  /charts           # Gráficos
/lib
  db.ts             # Cliente Prisma
  auth.ts           # Utilitários de autenticação
  utils.ts          # Funções auxiliares
/prisma
  schema.prisma     # Schema do banco
  seed.ts           # Dados de teste
```

## APIs

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Dados do usuário logado

### Agendamentos
- `GET /api/agendamentos?data=YYYY-MM-DD` - Lista agendamentos
- `POST /api/agendamentos` - Cria agendamento
- `PATCH /api/agendamentos/[id]` - Atualiza agendamento
- `DELETE /api/agendamentos/[id]` - Remove agendamento

### Bloqueios
- `GET /api/bloqueios` - Lista bloqueios ativos
- `POST /api/bloqueios` - Cria bloqueio
- `DELETE /api/bloqueios/[id]` - Remove bloqueio

### Estatísticas
- `GET /api/stats` - Estatísticas do dashboard
- `GET /api/stats/grafico?inicio=&fim=` - Dados para gráfico

### Webhooks (para n8n/agente IA)
- `POST /api/webhooks/agendar` - Criar agendamento via webhook
- `POST /api/webhooks/bloquear` - Criar bloqueio via webhook
- `DELETE /api/webhooks/desbloquear` - Remover bloqueio via webhook

## Cores do Design

- **Azul** (#2563EB) - Ações gerais
- **Verde** (#059669) - Agendamentos confirmados
- **Vermelho** (#DC2626) - Bloqueios
- **Cinza** - Horários livres

## Licença

Projeto privado - Todos os direitos reservados.

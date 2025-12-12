import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed do banco de dados...");

  // Cria usuário de teste
  const senhaHash = await bcrypt.hash("123456", 12);

  const usuario = await prisma.usuario.upsert({
    where: { email: "admin@clinica.com" },
    update: {},
    create: {
      nome: "Dr. João Silva",
      clinica: "Clínica Saúde Total",
      email: "admin@clinica.com",
      senhaHash,
      googleCalendarId: null,
    },
  });

  console.log("Usuário criado:", usuario.email);

  // Cria alguns agendamentos de exemplo
  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const agendamentos = [
    {
      pacienteNome: "Maria Santos",
      pacienteTelefone: "(11) 99999-1111",
      pacienteEmail: "maria@email.com",
      dataHora: new Date(hoje.setHours(9, 0, 0, 0)),
      tipo: "consulta",
      observacoes: "Primeira consulta",
    },
    {
      pacienteNome: "Pedro Oliveira",
      pacienteTelefone: "(11) 99999-2222",
      dataHora: new Date(hoje.setHours(10, 0, 0, 0)),
      tipo: "retorno",
    },
    {
      pacienteNome: "Ana Costa",
      pacienteTelefone: "(11) 99999-3333",
      pacienteEmail: "ana@email.com",
      dataHora: new Date(hoje.setHours(14, 30, 0, 0)),
      tipo: "avaliacao",
      observacoes: "Avaliação pré-operatória",
    },
    {
      pacienteNome: "Carlos Lima",
      pacienteTelefone: "(11) 99999-4444",
      dataHora: new Date(amanha.setHours(11, 0, 0, 0)),
      tipo: "procedimento",
    },
  ];

  for (const ag of agendamentos) {
    await prisma.agendamento.create({
      data: {
        usuarioId: usuario.id,
        ...ag,
        origem: "manual",
        status: "confirmado",
      },
    });
  }

  console.log(`${agendamentos.length} agendamentos criados`);

  // Cria um bloqueio de exemplo
  const proximaSemana = new Date(hoje);
  proximaSemana.setDate(proximaSemana.getDate() + 7);

  await prisma.bloqueio.create({
    data: {
      usuarioId: usuario.id,
      tipo: "horario",
      data: proximaSemana,
      horaInicio: "12:00",
      horaFim: "14:00",
      motivo: "Reunião administrativa",
      ativo: true,
    },
  });

  console.log("Bloqueio de exemplo criado");

  console.log("\n✅ Seed concluído com sucesso!");
  console.log("\nCredenciais de acesso:");
  console.log("Email: admin@clinica.com");
  console.log("Senha: 123456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

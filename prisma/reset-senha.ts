import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function resetSenha() {
  const novaSenha = "123456";
  const senhaHash = await bcrypt.hash(novaSenha, 12);

  const usuario = await prisma.usuario.update({
    where: { email: "admin@clinica.com" },
    data: { senhaHash },
  });

  console.log("✅ Senha resetada com sucesso!");
  console.log("Email:", usuario.email);
  console.log("Nova senha:", novaSenha);
}

resetSenha()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

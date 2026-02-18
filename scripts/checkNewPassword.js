// ⚠️ SCRIPT PARA TESTAR NOVA SENHA
// Use o script genérico checkPassword.js em vez deste

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

(async function main(){
  try {
    const email = process.env.TEST_EMAIL || process.argv[2];
    const password = process.env.TEST_PASSWORD || process.argv[3];

    if (!email || !password) {
      console.log('❌ Uso: node checkPassword.js <email> <password>');
      process.exit(1);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('❌ Usuário não encontrado');
      process.exit(1);
    }
    
    const ok = await bcrypt.compare(password, user.passwordHash);
    console.log(ok ? '✅ Senha correta!' : '❌ Senha incorreta');
  } catch (e) {
    console.error('❌ Erro:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();

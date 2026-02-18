// ⚠️ SCRIPT PARA VERIFICAÇÃO DE SENHA
// Use para testar se uma senha está correta para um email

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

(async function main(){
  try {
    const email = process.env.TEST_EMAIL || process.argv[2];
    const password = process.env.TEST_PASSWORD || process.argv[3];

    if (!email || !password) {
      console.log('❌ Uso: node checkPassword.js <email> <password>');
      console.log('   Ou defina TEST_EMAIL e TEST_PASSWORD no .env');
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
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();

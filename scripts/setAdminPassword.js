// ⚠️ SCRIPT DEPRECADO - USE ADMIN_PASSWORD NO .env
// Este script não deve ser usado em produção
// Para alterara senha do admin, use:
// 1. Defina ADMIN_PASSWORD no .env
// 2. Reinicie o servidor (setupSuperAdmin vai executar)
// 3. Ou use um script mais seguro com variáveis de ambiente

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

(async function main(){
  try {
    // ✅ LER DO .env EM VEZ DE HARDCODED
    const email = process.env.ADMIN_EMAIL || 'admin@stoqplus.com';
    const newPassword = process.env.ADMIN_PASSWORD_TEMP; // Senha temporária para reset

    if (!newPassword) {
      console.log('❌ Defina ADMIN_PASSWORD_TEMP no .env para resetar a senha');
      process.exit(1);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({ 
      where: { email }, 
      data: { passwordHash: hash } 
    });
    console.log('✅ Senha do admin alterada para:', updated.email);
  } catch (e) {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();

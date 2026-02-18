const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

(async function main(){
  try {
    const email = 'mateused0501@gmail.com';
    const newPlain = 'StoqMaster#2026!';
    const hash = await bcrypt.hash(newPlain, 10);
    const updated = await prisma.user.update({ where: { email }, data: { passwordHash: hash } });
    console.log('Updated user passwordHash for:', updated.email);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
})();

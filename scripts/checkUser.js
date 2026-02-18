const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function main(){
  try {
    const email = 'mateused0501@gmail.com';
    const user = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
    console.log('User query result:');
    console.dir(user, { depth: 5 });
  } catch (e) {
    console.error('Error querying user:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();

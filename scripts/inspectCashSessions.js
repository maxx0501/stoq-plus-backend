const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    const sessions = await prisma.cashSession.findMany({ include: { movements: true }, orderBy: { startedAt: 'desc' } });
    console.log(JSON.stringify(sessions, null, 2));
  } catch (e) {
    console.error('ERROR', e);
  } finally {
    await prisma.$disconnect();
  }
})();

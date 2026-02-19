import { PrismaClient } from '@prisma/client';

const prismaClient = new PrismaClient({
    log: process.env.NODE_ENV === 'production' 
        ? ['error', 'warn'] // Only errors and warnings in production
        : ['error', 'warn', 'info'], // More verbose in development
    errorFormat: 'pretty',
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    await prismaClient.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await prismaClient.$disconnect();
    process.exit(0);
});

export const prisma = prismaClient;
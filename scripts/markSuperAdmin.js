#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function markSuperAdmin(email) {
    if (!email) {
        console.error('❌ Erro: Forneça o email como argumento');
        console.log('Uso: node markSuperAdmin.js seu-email@exemplo.com');
        process.exit(1);
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user) {
            console.error(`❌ Usuário com email "${email}" não encontrado no banco.`);
            process.exit(1);
        }

        if (user.isSuperAdmin) {
            console.log(`✅ Usuário ${email} já é Super Admin.`);
            process.exit(0);
        }

        const updated = await prisma.user.update({
            where: { email },
            data: { isSuperAdmin: true }
        });

        console.log(`✅ Sucesso! ${email} agora é Super Admin!`);
        console.log(`\nDetalhes do usuário:`);
        console.log(`  ID: ${updated.id}`);
        console.log(`  Nome: ${updated.name}`);
        console.log(`  Email: ${updated.email}`);
        console.log(`  Super Admin: ${updated.isSuperAdmin}`);
        
    } catch (error) {
        console.error('❌ Erro ao atualizar:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

const email = process.argv[2];
markSuperAdmin(email);

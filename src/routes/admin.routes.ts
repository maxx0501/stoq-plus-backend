import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('❌ JWT_SECRET não definida em .env');
}

// --- GET /admin/dashboard ---
router.get('/dashboard', async (req, res) => {
    try {
        // Verifica token e isSuperAdmin
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        // Busca user para verificar se é SuperAdmin
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user?.isSuperAdmin) return res.status(403).json({ error: "Apenas SuperAdmin pode acessar" });

        // Métricas gerais
        const totalStores = await prisma.store.count();
        const totalUsers = await prisma.user.count();
        const proStores = await prisma.store.count({ where: { plan: 'PRO' } });

        // Informações de lojas com stats
        const stores = await prisma.store.findMany({
            include: {
                memberships: { include: { user: true } },
                products: { select: { id: true } },
                sales: { select: { id: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const formattedStores = await Promise.all(
            stores.map(async (store) => {
                const owner = store.memberships.find(m => m.role === 'OWNER');
                return {
                    id: store.id,
                    name: store.name,
                    plan: store.plan,
                    ownerName: owner?.user?.name || 'Sem proprietário',
                    ownerEmail: owner?.user?.email || 'N/A',
                    stats: {
                        products: store.products.length,
                        sales: store.sales.length,
                        users: store.memberships.length
                    },
                    createdAt: store.createdAt,
                    subscriptionExpiresAt: store.subscriptionExpiresAt
                };
            })
        );

        const pricePerPro = 49.90; // Preço mensal do plano PRO (R$ 49,90/mês)
        const mrr = proStores * pricePerPro;

        return res.json({
            metrics: {
                totalStores,
                totalUsers,
                proCount: proStores,
                mrr
            },
            stores: formattedStores
        });
    } catch (e: any) {
        console.error('Admin Dashboard Error:', e);
        return res.status(500).json({ error: "Erro ao buscar dados do painel.", details: e.message });
    }
});

// --- DELETE /admin/store/:id ---
router.delete('/store/:id', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user?.isSuperAdmin) return res.status(403).json({ error: "Apenas SuperAdmin" });

        const { id } = req.params;

        // 1. Busca todos os usuários da loja
        const storeUsers = await prisma.storeUser.findMany({
            where: { storeId: id },
            include: { user: true }
        });

        // 2. Deleta todos os usuários associados à loja
        for (const storeUser of storeUsers) {
            await prisma.sale.deleteMany({ where: { userId: storeUser.userId } });
            await prisma.stockEntry.deleteMany({ where: { userId: storeUser.userId } });
            await prisma.user.delete({ where: { id: storeUser.userId } });
        }

        // 3. Deleta a loja
        await prisma.store.delete({ where: { id } });

        return res.json({ message: "Loja e usuários deletados com sucesso." });
    } catch (e: any) {
        console.error('Delete Store Error:', e);
        return res.status(500).json({ error: "Erro ao deletar loja.", details: e.message });
    }
});

export default router;

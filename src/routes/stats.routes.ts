import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

// ROTA: / (O server.ts vai montar isso em /my-sales-metrics)
router.get('/', async (req, res) => {
    const user = (req as any).user;
    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        
        // Vendas de hoje
        const mySalesToday = await prisma.sale.findMany({ where: { storeId: user.storeId, userId: user.userId, createdAt: { gte: today } } });
        const revenueToday = mySalesToday.reduce((acc, s) => acc + Number(s.total), 0);
        
        // Gráfico (7 dias)
        const chartData = [];
        for(let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
            const next = new Date(d); next.setDate(d.getDate()+1);
            const sum = await prisma.sale.aggregate({ _sum: { total: true }, where: { storeId: user.storeId, userId: user.userId, createdAt: { gte: d, lt: next } } });
            chartData.push({ day: d.toLocaleDateString('pt-BR', { weekday: 'short' }), value: Number(sum._sum.total || 0) });
        }

        // Histórico recente
        const myRecentSales = await prisma.sale.findMany({ where: { storeId: user.storeId, userId: user.userId }, take: 5, orderBy: { createdAt: 'desc' }, include: { items: { include: { product: true } } } });
        
        return res.json({ revenueToday, countToday: mySalesToday.length, chartData, recentSales: myRecentSales });
    } catch (error) { return res.status(500).json({ error: "Erro metrics pessoais." }); }
});

export default router;
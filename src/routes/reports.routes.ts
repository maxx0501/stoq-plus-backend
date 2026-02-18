import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

// ROTA: / (O server.ts vai montar isso em /reports)
router.get('/', async (req, res) => {
    const user = (req as any).user;
    const { period } = req.query; // '30days', 'year', ou '7days' (padrão)

    try {
        const today = new Date();
        let startDate = new Date();

        // Define o período do filtro
        if (period === '30days') {
            startDate.setDate(today.getDate() - 30);
        } else if (period === 'year') {
            startDate.setFullYear(today.getFullYear() - 1);
        } else {
            startDate.setDate(today.getDate() - 7);
        }

        // Busca vendas no período
        const sales = await prisma.sale.findMany({
            where: {
                storeId: user.storeId,
                createdAt: { gte: startDate }
            },
            include: {
                items: {
                    include: { product: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        // --- CÁLCULOS FINANCEIROS ---
        let totalRevenue = 0;
        let totalCost = 0;
        const categoryMap: any = {};

        sales.forEach(sale => {
            totalRevenue += Number(sale.total);
            
            sale.items.forEach(item => {
                // Custo = Preço de Custo * Quantidade
                const cost = Number(item.product.costPrice || 0) * item.quantity;
                totalCost += cost;

                // Agrupamento por Categoria
                const cat = item.product.category || 'Outros';
                if (!categoryMap[cat]) categoryMap[cat] = 0;
                categoryMap[cat] += Number(item.price) * item.quantity;
            });
        });

        const netProfit = totalRevenue - totalCost;
        const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

        // --- DADOS PARA O GRÁFICO (Linha do Tempo) ---
        const salesByDay: any = {};
        const profitByDay: any = {};

        sales.forEach(sale => {
            const dateKey = new Date(sale.createdAt).toLocaleDateString('pt-BR');
            
            if (!salesByDay[dateKey]) {
                salesByDay[dateKey] = 0;
                profitByDay[dateKey] = 0;
            }

            salesByDay[dateKey] += Number(sale.total);

            // Calcula custo desta venda específica para saber o lucro do dia
            let saleCost = 0;
            sale.items.forEach(i => {
                saleCost += Number(i.product.costPrice || 0) * i.quantity;
            });
            profitByDay[dateKey] += (Number(sale.total) - saleCost);
        });

        const chartData = Object.keys(salesByDay).map(date => ({
            date,
            sales: salesByDay[date],
            profit: profitByDay[date]
        }));

        // --- DADOS PARA CATEGORIAS (Pizza/Donut) ---
        const categoryData = Object.keys(categoryMap)
            .map(name => ({ name, value: categoryMap[name] }))
            .sort((a, b) => b.value - a.value);

        return res.json({
            totalRevenue,
            netProfit,
            margin,
            chartData,
            categoryData
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erro ao gerar relatório." });
    }
});

export default router;
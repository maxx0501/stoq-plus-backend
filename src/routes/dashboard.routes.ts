import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

// --- ROTA 1: DASHBOARD PRINCIPAL (Simples e Rápida - 7 Dias) ---
router.get('/', async (req, res) => {
    const user = (req as any).user;
    const referenceDate = req.query.referenceDate ? new Date(String(req.query.referenceDate)) : new Date();
    try {
        // Datas para comparação
        const today = new Date(); 
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);

        // Vendas de hoje e ontem
        const salesToday = await prisma.sale.findMany({ where: { storeId: user.storeId, createdAt: { gte: startOfToday }, status: 'PAID' }, include: { items: { include: { product: true } } } });
        const salesYesterday = await prisma.sale.findMany({ where: { storeId: user.storeId, createdAt: { gte: startOfYesterday, lt: startOfToday }, status: 'PAID' }, include: { items: { include: { product: true } } } });

        // Função auxiliar de métricas
        const calculateMetrics = (sales: any[]) => { 
            let revenue = 0; 
            let cost = 0; 
            sales.forEach(sale => { 
                revenue += Number(sale.total); 
                sale.items.forEach((item: any) => { cost += Number(item.product.costPrice || 0) * item.quantity; }); 
            }); 
            return { revenue, cost, profit: revenue - cost, count: sales.length }; 
        };

        const metricsToday = calculateMetrics(salesToday);
        const metricsYesterday = calculateMetrics(salesYesterday);

        // Gráfico simplificado (7 Dias)
        let chartData = [];
        const startDateGraph = new Date(today); startDateGraph.setDate(today.getDate() - 6); startDateGraph.setHours(0,0,0,0);
        const endDateGraph = new Date();
        
        const salesPeriod = await prisma.sale.findMany({ where: { storeId: user.storeId, createdAt: { gte: startDateGraph, lte: endDateGraph }, status: 'PAID' } });
        const toLocalISO = (date: Date) => { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().split('T')[0]; };

        for (let i = 6; i >= 0; i--) { 
            const d = new Date(today); d.setDate(today.getDate() - i); 
            const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', ''); 
            const targetDateStr = toLocalISO(d); 
            const daySales = salesPeriod.filter(s => toLocalISO(new Date(s.createdAt)) === targetDateStr); 
            const total = daySales.reduce((acc, s) => acc + Number(s.total), 0); 
            chartData.push({ day: label, value: total }); 
        }

        // Alertas de Estoque Baixo
        const lowStockCount = await prisma.product.count({ where: { storeId: user.storeId, stock: { lte: 5 } } });
        
        // Vendas Recentes
        const recentSales = await prisma.sale.findMany({ 
            where: { storeId: user.storeId }, 
            take: 5, 
            orderBy: { createdAt: 'desc' }, 
            include: { items: { include: { product: true } }, user: { select: { name: true } } } 
        });

        // Top Produtos (Consertado)
        const topProductsRaw = await prisma.saleItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            where: { sale: { storeId: user.storeId, status: 'PAID' } },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5
        });

        const topProducts = await Promise.all(topProductsRaw.map(async (item) => {
            const p = await prisma.product.findUnique({ where: { id: item.productId } });
            return {
                name: p?.name || 'Produto Removido',
                quantity: item._sum.quantity,
                price: p?.price || 0
            };
        }));

        return res.json({ 
            today: metricsToday, 
            yesterday: metricsYesterday, 
            chartData, 
            lowStockCount, 
            recentSales, 
            topProducts 
        });

    } catch (error) { 
        console.error(error);
        return res.status(500).json({ error: "Erro dashboard" }); 
    }
});

// --- ROTA 2: ANALYTICS AVANÇADO (Mantive para os Widgets não quebrarem) ---
router.get('/advanced', async (req, res) => {
    const user = (req as any).user;
    try {
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sales = await prisma.sale.findMany({
            where: { storeId: user.storeId, createdAt: { gte: thirtyDaysAgo }, status: 'PAID' },
            include: { items: { include: { product: true } }, user: true, customer: true }
        });

        const sellerMap: any = {}; const paymentMap: any = {}; const hoursMap = new Array(24).fill(0);
        const weekDayMap = new Array(7).fill(0); const categoryMap: any = {}; const dailyMap: any = {}; const customerMap: any = {};

        sales.forEach(sale => {
            const total = Number(sale.total);
            const date = new Date(sale.createdAt);
            const dateKey = date.toLocaleDateString('pt-BR');
            const sellerName = sale.user?.name || 'Sistema';
            
            sellerMap[sellerName] = (sellerMap[sellerName] || 0) + total;
            paymentMap[sale.paymentMethod] = (paymentMap[sale.paymentMethod] || 0) + total;
            hoursMap[date.getHours()] += 1; 
            weekDayMap[date.getDay()] += total;
            if (sale.customer) customerMap[sale.customer.name] = (customerMap[sale.customer.name] || 0) + total;
            if (!dailyMap[dateKey]) dailyMap[dateKey] = { total: 0, count: 0 };
            dailyMap[dateKey].total += total; dailyMap[dateKey].count += 1;
            sale.items.forEach(item => { const cat = item.product.category || 'Outros'; categoryMap[cat] = (categoryMap[cat] || 0) + (Number(item.price) * item.quantity); });
        });

        const sellers = Object.keys(sellerMap).map(k => ({ name: k, value: sellerMap[k] })).sort((a,b) => b.value - a.value).slice(0,5);
        const payments = Object.keys(paymentMap).map(k => ({ name: k, value: paymentMap[k] }));
        const categories = Object.keys(categoryMap).map(k => ({ name: k, value: categoryMap[k] })).sort((a,b) => b.value - a.value).slice(0,5);
        const salesByHour = hoursMap.map((count, hour) => ({ name: `${hour}h`, value: count }));
        const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const salesByWeekDay = weekDayMap.map((val, idx) => ({ name: weekDays[idx], value: val }));
        const topCustomers = Object.keys(customerMap).map(k => ({ name: k, value: customerMap[k] })).sort((a,b) => b.value - a.value).slice(0,5);

        const dailyHistory = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('pt-BR');
            const dataDay = dailyMap[key] || { total: 0, count: 0 };
            dailyHistory.push({ date: key.slice(0, 5), total: dataDay.total, ticket: dataDay.count > 0 ? (dataDay.total / dataDay.count) : 0, count: dataDay.count });
        }

        return res.json({ sellers, payments, categories, salesByHour, salesByWeekDay, topCustomers, dailyHistory });
    } catch (error) { return res.status(500).json({ error: "Erro analytics" }); }
});

export default router;
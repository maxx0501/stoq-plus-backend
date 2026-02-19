import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

// --- 1. CRIAR VENDA (PDV) ---
router.post('/', async (req, res) => {
    const user = (req as any).user;
    try {
        const { items, customerId, paymentMethod } = req.body;
        
        let total = 0;
        let status = (paymentMethod === 'CREDIT_STORE') ? 'PENDING' : 'PAID';
        let dueDate = (status === 'PENDING') ? new Date(new Date().setDate(new Date().getDate() + 30)) : null;

        const sale = await prisma.$transaction(async (tx) => {
            for (const item of items) {
                const p = await tx.product.findUnique({ where: { id: item.productId } });
                const quantity = Number(item.quantity);
                if (!p || p.stock < quantity) throw new Error(`Estoque insuficiente: ${p?.name}`);
                total += Number(p.price) * quantity;
            }

            const newSale = await tx.sale.create({
                data: {
                    storeId: user.storeId, userId: user.userId, customerId: customerId || null,
                    total, paymentMethod: paymentMethod || 'MONEY', status: status as any, dueDate
                }
            });

            for (const item of items) {
                const p = await tx.product.findUnique({ where: { id: item.productId } });
                const quantity = Number(item.quantity);
                await tx.saleItem.create({ data: { saleId: newSale.id, productId: item.productId, quantity: quantity, price: p!.price } });
                await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: quantity } } });
            }
            return newSale;
        });
        return res.json(sale);
    } catch (e: any) { return res.status(400).json({ error: e.message || "Erro ao processar venda." }); }
});

// --- 2. LISTAR DÍVIDAS ---
router.get('/debts', async (req, res) => {
    const user = (req as any).user;
    try {
        const debts = await prisma.sale.findMany({
            where: { storeId: user.storeId, paymentMethod: 'CREDIT_STORE', status: 'PENDING' },
            include: { customer: { select: { name: true, phone: true } }, items: { include: { product: { select: { name: true } } } } },
            orderBy: { dueDate: 'asc' }
        });
        return res.json(debts);
    } catch (error) { return res.status(500).json({ error: "Erro ao buscar dívidas." }); }
});

// --- 3. PAGAR DÍVIDA ---
router.put('/:id/pay', async (req, res) => {
    const user = (req as any).user;
    try {
        await prisma.sale.updateMany({
            where: { id: req.params.id, storeId: user.storeId },
            data: { status: 'PAID' }
        });
        return res.json({ message: "Dívida quitada!" });
    } catch (error) { return res.status(500).json({ error: "Erro ao dar baixa." }); }
});

// --- 4. SUAS VENDAS (Métricas Pessoais) ---
router.get('/my-metrics', async (req, res) => {
    const user = (req as any).user;
    try {
        const today = new Date(); today.setHours(0,0,0,0);
        const salesToday = await prisma.sale.findMany({ where: { storeId: user.storeId, userId: user.userId, createdAt: { gte: today } } });
        const revenueToday = salesToday.reduce((acc, s) => acc + Number(s.total), 0);
        
        const chartData = [];
        for(let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
            const next = new Date(d); next.setDate(d.getDate()+1);
            const sum = await prisma.sale.aggregate({ _sum: { total: true }, where: { storeId: user.storeId, userId: user.userId, createdAt: { gte: d, lt: next } } });
            chartData.push({ day: d.toLocaleDateString('pt-BR', { weekday: 'short' }), value: Number(sum._sum.total || 0) });
        }
        const recentSales = await prisma.sale.findMany({ where: { storeId: user.storeId, userId: user.userId }, take: 5, orderBy: { createdAt: 'desc' }, include: { items: { include: { product: true } } } });
        return res.json({ revenueToday, countToday: salesToday.length, chartData, recentSales });
    } catch (e) { return res.status(500).json({ error: "Erro metrics." }); }
});

// --- 5. DASHBOARD METRICS (A Rota que estamos corrigindo) ---
router.get('/dashboard-metrics', async (req, res) => {
    const user = (req as any).user;
    
    // CORREÇÃO: Força converter para string para evitar erros de leitura
    const period = String(req.query.period || '7days');

    try {
        const today = new Date();
        const start = new Date();
        let end = new Date(); 

        // LÓGICA DE DATAS (Se period for 'month', ele TEM que cair no if do meio)
        if (period === 'year') {
            start.setMonth(0, 1); start.setHours(0, 0, 0, 0);
            end = new Date(start.getFullYear(), 11, 31, 23, 59, 59);
        } else if (period === 'month') {
            start.setDate(1); start.setHours(0, 0, 0, 0);
            end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
        } else {
            // Padrão (7days)
            start.setDate(today.getDate() - 6); start.setHours(0, 0, 0, 0);
            end = new Date();
        }

        const sales = await prisma.sale.findMany({
            where: { storeId: user.storeId, createdAt: { gte: start, lte: end }, status: 'PAID' },
            include: { items: true } 
        });

        // EIXO X (Rótulos)
        const chartMap = new Map();
        
        // Função que define se mostra Dia (01, 02) ou Semana (Seg, Ter)
        const getLabel = (date: Date) => {
            if (period === 'year') return date.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
            else if (period === 'month') return date.getDate().toString().padStart(2, '0'); // RETORNA NÚMERO
            else return date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
        };

        let loopDate = new Date(start);
        while (loopDate <= end) {
            const label = getLabel(loopDate);
            if (!chartMap.has(label)) chartMap.set(label, 0);
            
            if (period === 'year') loopDate.setMonth(loopDate.getMonth() + 1);
            else loopDate.setDate(loopDate.getDate() + 1);
        }

        let totalRevenue = 0;
        sales.forEach(sale => {
            const label = getLabel(new Date(sale.createdAt));
            const val = Number(sale.total);
            if (chartMap.has(label)) chartMap.set(label, chartMap.get(label) + val);
            totalRevenue += val;
        });

        const chartData = Array.from(chartMap, ([day, value]) => ({ day, value }));

        // Outros Dados (Top Produtos, KPIs)
        const productMap: any = {};
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if(!productMap[item.productId]) productMap[item.productId] = { name: 'Prod', quantity: 0, price: Number(item.price) };
                productMap[item.productId].quantity += item.quantity;
            });
        });
        const productIds = Object.keys(productMap);
        const dbProducts = await prisma.product.findMany({ where: { id: { in: productIds } } });
        dbProducts.forEach(p => { if(productMap[p.id]) productMap[p.id].name = p.name; });
        const topProducts = Object.values(productMap).sort((a:any, b:any) => b.quantity - a.quantity).slice(0, 5);

        const recentSales = await prisma.sale.findMany({ where: { storeId: user.storeId }, orderBy: { createdAt: 'desc' }, take: 5, include: { user: true, items: true } });
        
        const startToday = new Date(); startToday.setHours(0,0,0,0);
        const startYesterday = new Date(startToday); startYesterday.setDate(startYesterday.getDate() - 1);
        const endYesterday = new Date(startToday); endYesterday.setMilliseconds(-1);
        const salesToday = await prisma.sale.findMany({ where: { storeId: user.storeId, createdAt: { gte: startToday } } });
        const salesYesterday = await prisma.sale.findMany({ where: { storeId: user.storeId, createdAt: { gte: startYesterday, lte: endYesterday } } });
        const todayRevenue = salesToday.reduce((acc, s) => acc + Number(s.total), 0);
        const yesterdayRevenue = salesYesterday.reduce((acc, s) => acc + Number(s.total), 0);
        const lowStockCount = await prisma.product.count({ where: { storeId: user.storeId, stock: { lte: 5 } } });

        return res.json({
            chartData, topProducts, recentSales,
            today: { revenue: todayRevenue, count: salesToday.length, profit: todayRevenue * 0.3 },
            yesterday: { revenue: yesterdayRevenue, profit: yesterdayRevenue * 0.3 },
            lowStockCount
        });

    } catch (error) { return res.status(500).json({ error: "Erro dashboard metrics" }); }
});

// --- 6. ANALYTICS AVANÇADO ---
router.get('/analytics/advanced', async (req, res) => {
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
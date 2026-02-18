import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

// Aplica segurança em todas as rotas abaixo
router.use(authMiddleware);

router.get('/', async (req, res) => {
    const user = (req as any).user;
    try {
        const products = await prisma.product.findMany({ where: { storeId: user.storeId }, orderBy: { id: 'desc' } });
        return res.json(products);
    } catch (e) { return res.status(401).json({ error: "Erro ao buscar produtos." }); }
});

router.post('/', async (req, res) => {
    const user = (req as any).user;
    try {
        const { name, price, stock, description, category, imageUrl } = req.body;
        const product = await prisma.product.create({ 
            data: { 
                storeId: user.storeId, name, price: Number(price), stock: Number(stock), 
                description: description || '', category: category || 'Geral', imageUrl: imageUrl || '' 
            } 
        });
        return res.json(product);
    } catch (e) { return res.status(500).json({ error: "Erro criar produto." }); }
});

router.put('/:id', async (req, res) => {
    const user = (req as any).user;
    try {
        await prisma.product.updateMany({ where: { id: req.params.id, storeId: user.storeId }, data: req.body });
        return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ error: "Erro editar." }); }
});

router.delete('/:id', async (req, res) => {
    const user = (req as any).user;
    try {
        await prisma.product.deleteMany({ where: { id: req.params.id, storeId: user.storeId } });
        return res.sendStatus(204);
    } catch (e) { return res.status(500).json({ error: "Erro deletar." }); }
});

// Movimentação de Estoque
router.post('/entry', async (req, res) => {
    const user = (req as any).user;
    try {
        const { productId, quantity, newCostPrice, type, reason } = req.body;
        const qty = Number(quantity);
        
        const currentProduct = await prisma.product.findUnique({ where: { id: productId } });
        if (!currentProduct) return res.status(404).json({ error: "Produto não encontrado." });

        const isLoss = type === 'LOSS';
        
        await prisma.$transaction(async (tx) => {
            await tx.product.update({ 
                where: { id: productId }, 
                data: { stock: isLoss ? { decrement: qty } : { increment: qty }, costPrice: (!isLoss && newCostPrice) ? Number(newCostPrice) : undefined } 
            });
            await tx.stockEntry.create({ 
                data: { storeId: user.storeId, productId, quantity: qty, oldStock: currentProduct.stock, newStock: isLoss ? currentProduct.stock - qty : currentProduct.stock + qty, entryType: type || 'ENTRY', reason, userId: user.userId } 
            });
        });
        return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: "Erro estoque." }); }
});

// Histórico de Estoque
router.get('/history', async (req, res) => {
    const user = (req as any).user;
    try {
        const history = await prisma.stockEntry.findMany({ where: { storeId: user.storeId }, orderBy: { createdAt: 'desc' }, take: 50, include: { product: { select: { name: true } } } });
        return res.json(history);
    } catch (error) { return res.status(500).json({ error: "Erro histórico estoque." }); }
});

export default router;
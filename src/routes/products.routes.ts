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
        const { name, price, stock, description, category, imageUrl, costPrice, minStock, isVisible } = req.body;
        
        // Validação básica
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: "Nome é obrigatório." });
        }
        if (price === undefined || price === null || Number(price) < 0) {
            return res.status(400).json({ error: "Preço deve ser um número válido." });
        }
        
        const product = await prisma.product.create({ 
            data: { 
                storeId: user.storeId, 
                name: name.trim(), 
                price: Number(price), 
                stock: Number(stock) || 0, 
                description: (description || '').trim(), 
                category: (category || 'Geral').trim(), 
                imageUrl: imageUrl || '',
                costPrice: costPrice ? Number(costPrice) : 0,
                minStock: minStock ? Number(minStock) : 0,
                isVisible: isVisible !== false
            } 
        });
        return res.json(product);
    } catch (e: any) { 
        console.error('Erro ao criar produto:', e);
        return res.status(500).json({ error: "Erro criar produto: " + e.message }); 
    }
});

router.put('/:id', async (req, res) => {
    const user = (req as any).user;
    try {
        // Valida QUE O PRODUTO PERTENCE À LOJA ANTES DE ATUALIZAR
        const existingProduct = await prisma.product.findUnique({ where: { id: req.params.id } });
        if (!existingProduct) {
            return res.status(404).json({ error: "Produto não encontrado." });
        }
        if (existingProduct.storeId !== user.storeId) {
            return res.status(403).json({ error: "Acesso negado." });
        }
        
        // Prepara os dados, convertendo tipos corretamente
        const updateData: any = { ...req.body };
        
        // Converte valores numéricos se recebidos como string
        if (updateData.price !== undefined && updateData.price !== null) {
            updateData.price = Number(updateData.price);
        }
        if (updateData.stock !== undefined && updateData.stock !== null) {
            updateData.stock = Number(updateData.stock);
        }
        if (updateData.costPrice !== undefined && updateData.costPrice !== null) {
            updateData.costPrice = Number(updateData.costPrice);
        }
        if (updateData.minStock !== undefined && updateData.minStock !== null) {
            updateData.minStock = Number(updateData.minStock);
        }
        
        // Remove campos que não devem ser editados
        delete updateData.storeId;
        delete updateData.id;
        
        const product = await prisma.product.update({ 
            where: { id: req.params.id },
            data: updateData
        });
        return res.json(product);
    } catch (e: any) { 
        console.error('Erro ao editar produto:', e);
        return res.status(500).json({ error: "Erro ao editar produto: " + e.message }); 
    }
});

router.delete('/:id', async (req, res) => {
    const user = (req as any).user;
    try {
        const product = await prisma.product.findUnique({ where: { id: req.params.id } });
        if (!product) return res.status(404).json({ error: "Produto não encontrado." });
        if (product.storeId !== user.storeId) {
            return res.status(403).json({ error: "Acesso negado." });
        }
        await prisma.product.delete({ where: { id: req.params.id } });
        return res.json({ ok: true });
    } catch (e) { return res.status(500).json({ error: "Erro ao deletar produto." }); }
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
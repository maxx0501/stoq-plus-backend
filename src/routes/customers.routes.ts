import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

// --- HELPER: Garante que temos o ID da loja ---
const getStoreId = async (user: any) => {
    if (user.storeId) return user.storeId;
    
    // Se não tiver no token, busca no banco
    const link = await prisma.storeUser.findFirst({ 
        where: { userId: user.userId } 
    });
    return link?.storeId;
};

// 1. LISTAR CLIENTES
router.get('/', async (req, res) => {
    const user = (req as any).user;
    try {
        const storeId = await getStoreId(user);
        if (!storeId) return res.json([]);

        const customers = await prisma.customer.findMany({ 
            where: { storeId }, 
            orderBy: { name: 'asc' }, 
            include: { _count: { select: { sales: true } } } 
        });
        return res.json(customers);
    } catch (e) { 
        return res.status(500).json({ error: "Erro ao buscar clientes." }); 
    }
});

// 2. CRIAR CLIENTE
router.post('/', async (req, res) => {
    const user = (req as any).user;
    
    // Pegamos apenas campos permitidos (Email e Endereço agora são opcionais no frontend, mas o backend aceita string vazia)
    const { name, email, phone, cpf, address } = req.body;

    try {
        const storeId = await getStoreId(user);
        if (!storeId) return res.status(400).json({ error: "Loja não encontrada." });

        const customer = await prisma.customer.create({ 
            data: { 
                name, 
                email: email || null, // Salva null se vier vazio
                phone: phone || null, 
                cpf: cpf || null, 
                address: address || null,
                storeId 
            } 
        });
        return res.json(customer);
    } catch (e) { 
        return res.status(500).json({ error: "Erro ao criar cliente." }); 
    }
});

// 3. EDITAR CLIENTE
router.put('/:id', async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;
    
    // Removemos id e storeId para não dar erro no Prisma
    const { name, email, phone, cpf, address } = req.body;

    try {
        const storeId = await getStoreId(user);

        const result = await prisma.customer.updateMany({ 
            where: { id, storeId }, 
            data: { 
                name, 
                email: email || null,
                phone: phone || null,
                cpf: cpf || null,
                address: address || null
            } 
        });

        if (result.count === 0) {
            return res.status(404).json({ error: "Cliente não encontrado." });
        }

        return res.json({ message: "Atualizado com sucesso" });
    } catch (e) { 
        return res.status(500).json({ error: "Erro ao atualizar cliente." }); 
    }
});

// 4. REMOVER CLIENTE
router.delete('/:id', async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;

    try {
        const storeId = await getStoreId(user);

        // Verifica se tem vendas antes de deletar
        const salesCount = await prisma.sale.count({
            where: { customerId: id, storeId }
        });

        if (salesCount > 0) {
            return res.status(400).json({ error: "Não é possível excluir clientes com histórico de vendas." });
        }

        const deleted = await prisma.customer.deleteMany({ 
            where: { id, storeId } 
        });

        if (deleted.count === 0) {
            return res.status(404).json({ error: "Cliente não encontrado." });
        }

        return res.json({ message: "Removido com sucesso" });
    } catch (e) { 
        return res.status(500).json({ error: "Erro ao remover cliente." }); 
    }
});

// 5. HISTÓRICO
router.get('/:id/history', async (req, res) => {
    const user = (req as any).user;
    try {
        const storeId = await getStoreId(user);
        
        const sales = await prisma.sale.findMany({
            where: { storeId, customerId: req.params.id },
            include: { items: { include: { product: { select: { name: true } } } } },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(sales);
    } catch (e) { 
        return res.status(500).json({ error: "Erro histórico." }); 
    }
});

export default router;
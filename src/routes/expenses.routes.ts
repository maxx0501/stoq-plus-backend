import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

// 1. Listar Despesas
router.get('/', async (req, res) => {
    const user = (req as any).user;
    try {
        const expenses = await prisma.expense.findMany({
            where: { storeId: user.storeId },
            orderBy: { dueDate: 'asc' }
        });
        return res.json(expenses);
    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar despesas" });
    }
});

// 2. Criar Nova Despesa (COM LÓGICA DE REPETIÇÃO)
router.post('/', async (req, res) => {
    const user = (req as any).user;
    // Recebemos o repeatCount (quantas vezes repetir)
    const { description, category, value, dueDate, paid, repeatCount } = req.body;

    const loops = repeatCount && Number(repeatCount) > 1 ? Number(repeatCount) : 1;

    try {
        // Criamos um array de despesas para salvar tudo de uma vez
        const expensesToCreate = Array.from({ length: loops }).map((_, index) => {
            // Calcula a data correta para cada parcela
            const date = new Date(dueDate);
            date.setMonth(date.getMonth() + index); // Adiciona +1 mês a cada volta do loop

            // Adiciona (1/12) na descrição se for recorrente
            const finalDesc = loops > 1 
                ? `${description} (${index + 1}/${loops})` 
                : description;

            return {
                storeId: user.storeId,
                description: finalDesc,
                category,
                value: Number(value),
                dueDate: date,
                paid: index === 0 ? (paid || false) : false, // Só a primeira pode nascer paga, as futuras não
                paidAt: (index === 0 && paid) ? new Date() : null
            };
        });

        // Salva todas de uma vez (createMany é muito rápido)
        await prisma.expense.createMany({
            data: expensesToCreate
        });

        return res.json({ message: "Despesas criadas com sucesso!", count: loops });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erro ao criar despesa" });
    }
});

// 3. Alternar Status (Pago/Não Pago)
router.patch('/:id/toggle', async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;

    try {
        const expense = await prisma.expense.findUnique({ where: { id } });
        if (!expense) return res.status(404).json({ error: "Despesa não encontrada" });

        const updated = await prisma.expense.update({
            where: { id },
            data: { 
                paid: !expense.paid,
                paidAt: !expense.paid ? new Date() : null
            }
        });
        return res.json(updated);
    } catch (error) {
        return res.status(500).json({ error: "Erro ao atualizar" });
    }
});

// 4. Excluir Despesa
router.delete('/:id', async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;

    try {
        await prisma.expense.deleteMany({ 
            where: { id, storeId: user.storeId } 
        });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: "Erro ao deletar" });
    }
});

export default router;
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

// Listar Vendedores (MANTENHA IGUAL)
router.get('/', async (req, res) => {
    const user = (req as any).user;
    try {
        const sellers = await prisma.storeUser.findMany({ where: { storeId: user.storeId, NOT: { role: 'OWNER' } }, include: { user: true } });
        return res.json(sellers.map(s => ({ id: s.id, name: s.user.name, email: s.user.email, role: s.role, canSell: s.canSell, canManageProducts: s.canManageProducts })));
    } catch (e) { return res.status(500).json({ error: "Erro equipe." }); }
});
router.post('/', async (req, res) => {
    const user = (req as any).user;
    if (user.role === 'SELLER') return res.status(403).json({error: "Sem permissão"});

    try {
        const { name, email, password, role, canSell, canManageProducts } = req.body;

        // Validação de role
        const validRoles = ['SELLER', 'MANAGER'] as const;
        const assignedRole = role || 'SELLER';
        if (!validRoles.includes(assignedRole)) {
            return res.status(400).json({ error: "Role inválido. Use SELLER ou MANAGER." });
        }

        // Prevenção de escalação: Manager não pode criar Manager
        if (user.role === 'MANAGER' && assignedRole === 'MANAGER') {
            return res.status(403).json({ error: "Gerentes não podem criar outros gerentes." });
        }

        if (!password || password.length < 8) {
            return res.status(400).json({ error: "A senha provisória deve ter no mínimo 8 caracteres." });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: "Este e-mail já está cadastrado no sistema." });
        }

        const hash = await bcrypt.hash(password, 10);

        await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    name,
                    email,
                    passwordHash: hash,
                    isVerified: true,
                    mustChangePassword: true
                }
            });

            await tx.storeUser.create({
                data: {
                    userId: newUser.id,
                    storeId: user.storeId,
                    role: assignedRole,
                    canSell: canSell !== undefined ? canSell : true,
                    canManageProducts: canManageProducts !== undefined ? canManageProducts : false
                }
            });
        });

        return res.status(201).json({ message: "Criado." });
    } catch (e) {
        console.error("Erro ao criar membro da equipe:", e);
        return res.status(500).json({ error: "Erro ao criar membro." });
    }
});

// Editar Permissões (NOVO)
router.put('/member/:id', async (req, res) => {
    const user = (req as any).user;
    const { role, canSell, canManageProducts } = req.body;

    // Validação de role
    if (role) {
        const validRoles = ['SELLER', 'MANAGER'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: "Role inválido. Use SELLER ou MANAGER." });
        }
        if (user.role === 'MANAGER' && role === 'MANAGER') {
            return res.status(403).json({ error: "Gerentes não podem promover a gerente." });
        }
    }

    try {
        const updated = await prisma.storeUser.updateMany({
            where: { id: req.params.id, storeId: user.storeId },
            data: { role, canSell, canManageProducts }
        });

        if (updated.count === 0) {
            return res.status(404).json({ error: "Membro não encontrado." });
        }

        return res.json({ message: "Permissões atualizadas." });
    } catch (e) { 
        return res.status(500).json({ error: "Erro ao atualizar permissões." }); 
    }
});

// Demitir - Remove a relação StoreUser e o User se não tiver outras lojas
router.delete('/:id', async (req, res) => {
    const user = (req as any).user;
    // ✅ OWNER ou Super Admin pode deletar membros de equipe
    if (!user.isSuperAdmin && user.role !== 'OWNER') {
        return res.status(403).json({error: "Apenas proprietário ou Super Admin podem remover funcionários."});
    }
    try {
        const membership = await prisma.storeUser.findUnique({ where: { id: req.params.id } });
        if (!membership) {
            return res.status(404).json({ error: "Membro não encontrado." });
        }
        
        // Verificar se o usuário tem outras lojas
        const otherStores = await prisma.storeUser.count({
            where: { userId: membership.userId, NOT: { id: req.params.id } }
        });
        
        // Deletar a relação StoreUser
        await prisma.storeUser.delete({ where: { id: req.params.id } });
        
        // Se não tem outras lojas, deletar o usuário também
        if (otherStores === 0) {
            await prisma.user.delete({ where: { id: membership.userId } });
        }
        
        return res.status(200).json({ message: "Funcionário removido com sucesso." });
    } catch (e) { 
        console.error('Delete team member error:', e);
        return res.status(500).json({ error: "Erro ao demitir." }); 
    }
});

export default router;
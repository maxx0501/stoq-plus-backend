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
        // 1. Lendo TODAS as variáveis que o front envia, incluindo as permissões
        const { name, email, password, role, canSell, canManageProducts } = req.body;

        // 2. Trava de segurança: Evita criar senha "123" que falha no login
        if (!password || password.length < 8) {
            return res.status(400).json({ error: "A senha provisória deve ter no mínimo 8 caracteres." });
        }

        // 3. Prevenção de quebra do servidor (Verifica se o email já existe)
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
                    isVerified: true // Já marca como verificado pois o dono criou
                } 
            });
            
            await tx.storeUser.create({ 
                data: { 
                    userId: newUser.id, 
                    storeId: user.storeId, 
                    role: role || 'SELLER',
                    // 4. Salvando as permissões diretamente na criação!
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

// Demitir - Remove apenas a relação StoreUser, não o usuário inteiro
router.delete('/:id', async (req, res) => {
    const user = (req as any).user;
    if (user.role !== 'OWNER') return res.status(403).json({error: "Apenas dono."});
    try {
        const membership = await prisma.storeUser.findUnique({ where: { id: req.params.id } });
        if (!membership) {
            return res.status(404).json({ error: "Membro não encontrado." });
        }
        // Apenas remove a relação StoreUser, não deleta o usuário
        await prisma.storeUser.delete({ where: { id: req.params.id } });
        return res.status(204).send();
    } catch (e) { return res.status(500).json({ error: "Erro ao demitir." }); }
});

export default router;
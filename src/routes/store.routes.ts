import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// Protege todas as rotas de loja
router.use(authMiddleware);

// --- 1. CRIAR LOJA (POST /stores) ---
router.post('/', async (req, res) => {
    // Garante que pega o userId independente de como o middleware anexa (req.user ou req.userId)
    const reqUser = (req as any).user || (req as any); 
    const userId = reqUser.userId || reqUser.id; 
    
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: "Nome da loja é obrigatório." });

    try {
        const existingLink = await prisma.storeUser.findFirst({ where: { userId: userId } });
        if (existingLink) {
            return res.status(400).json({ error: "Você já possui uma loja cadastrada." });
        }

        // 1. Cria loja e vínculo no DB
        const result = await prisma.$transaction(async (tx) => {
            const newStore = await tx.store.create({
                data: {
                    name,
                    plan: 'FREE' 
                }
            });

            await tx.storeUser.create({
                data: {
                    userId: userId,
                    storeId: newStore.id,
                    role: 'OWNER',
                    canSell: true,
                    canManageProducts: true
                }
            });

            return newStore;
        });

        // 2. GERAR NOVO TOKEN ATUALIZADO
        // Essencial: O usuário agora tem role 'OWNER' e um 'storeId'
        const newToken = jwt.sign(
            { 
                userId: userId, 
                role: 'OWNER',      
                storeId: result.id  
            }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );

        return res.status(201).json({ 
            store: result,
            token: newToken, 
            message: "Loja criada com sucesso!"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erro ao criar loja." });
    }
});

// --- 2. ATUALIZAR LOJA (PUT /stores/me) ---
router.put('/me', async (req, res) => {
    // Garante a mesma lógica de extração do ID
    const reqUser = (req as any).user || (req as any); 
    const userId = reqUser.userId || reqUser.id; 

    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Nome da loja é obrigatório." });
    }

    try {
        // Verifica se o usuário é dono da loja
        const storeUser = await prisma.storeUser.findFirst({
            where: { 
                userId: userId,
                role: 'OWNER' 
            }
        });

        if (!storeUser) {
            return res.status(403).json({ error: "Permissão negada. Apenas o dono pode alterar o nome da loja." });
        }

        // Atualiza a loja vinculada
        const updatedStore = await prisma.store.update({
            where: { id: storeUser.storeId },
            data: { name }
        });

        return res.json(updatedStore);

    } catch (error) {
        console.error("Erro ao atualizar loja:", error);
        return res.status(500).json({ error: "Erro ao atualizar dados da loja." });
    }
});

export default router;
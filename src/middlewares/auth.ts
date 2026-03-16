import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('ERRO CRITICO: JWT_SECRET nao definida em .env');
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token inválido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET!) as any;
        
        // ✅ Validar que os dados necessários estão no token
        if (!decoded.userId) {
            return res.status(401).json({ error: 'Token inválido - userId ausente' });
        }
        
        (req as any).user = decoded;
        next();
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expirado' });
        }
        if (err instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Token inválido' });
        }
        return res.status(401).json({ error: 'Erro ao validar token' });
    }
};

// Middleware para verificar se a loja tem assinatura ativa ou está no período de trial
export const checkSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        if (!user?.storeId) return next(); // Sem loja, deixa passar (outras rotas tratam)

        const storeUser = await prisma.storeUser.findFirst({
            where: { userId: user.userId, storeId: user.storeId },
            include: { store: true }
        });

        if (!storeUser?.store) return next();

        const store = storeUser.store;

        // Sellers não são bloqueados por assinatura
        if (storeUser.role === 'SELLER') return next();

        // Plano PRO com assinatura ativa
        if (store.plan === 'PRO' && store.isSubscribed) {
            // Verifica se expirou
            if (store.subscriptionExpiresAt && new Date() > store.subscriptionExpiresAt) {
                await prisma.store.update({
                    where: { id: store.id },
                    data: { isSubscribed: false }
                });
                return res.status(403).json({ error: 'Assinatura expirada. Renove para continuar.' });
            }
            return next();
        }

        // Plano PRO sem assinatura ativa (expirou)
        if (store.plan === 'PRO' && !store.isSubscribed) {
            return res.status(403).json({ error: 'Assinatura expirada. Renove para continuar.' });
        }

        // Plano FREE — verifica trial de 30 dias
        const createdDate = new Date(store.createdAt);
        const trialEnd = new Date(createdDate);
        trialEnd.setDate(createdDate.getDate() + 30);

        if (new Date() > trialEnd) {
            return res.status(403).json({ error: 'Período de teste encerrado. Assine para continuar.' });
        }

        return next();
    } catch (error) {
        console.error('Erro no checkSubscription:', error);
        return next(); // Em caso de erro, não bloqueia (fail-open para não quebrar o sistema)
    }
};
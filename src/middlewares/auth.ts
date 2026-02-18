import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// 🔒 SEGURANÇA: JWT_SECRET deve estar em .env, nunca com fallback
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('❌ ERRO CRÍTICO: JWT_SECRET não definida em .env');
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
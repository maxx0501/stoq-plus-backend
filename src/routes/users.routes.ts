import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';
import axios from 'axios';


const router = Router();

// --- 1. CONFIGURAÇÃO DO MULTER (Upload de Imagens) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Define a pasta 'uploads' na raiz do projeto (sobe 2 níveis de 'src/routes')
        const uploadPath = path.resolve(__dirname, '..', '..', 'uploads');
        
        // Cria a pasta se ela não existir
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Cria um nome único: avatar-timestamp-numeroAleatorio.extensão
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB (opcional)
});

// --- 2. ROTA DE ATUALIZAR PERFIL ---
// O middleware 'upload.single' processa o arquivo que vem no campo 'avatar' do FormData
router.put('/me', authMiddleware, upload.single('avatar'), async (req, res) => {
    const { name } = req.body;
    const file = req.file; // Aqui está o arquivo da imagem, se foi enviado

    // Tenta pegar o ID de várias formas (dependendo de como seu authMiddleware salva)
    const userId = (req as any).userId || (req as any).user?.userId;

    if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado." });
    }

    try {
        // Objeto com os dados que vamos atualizar
        const dataToUpdate: any = {};
        
        if (name) dataToUpdate.name = name;
        
        // Se o usuário enviou uma foto nova
        if (file) {
            // Usa variável de ambiente para suportar tanto local quanto produção
            const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:3333';
            dataToUpdate.avatarUrl = `${backendUrl}/uploads/${file.filename}`;
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: dataToUpdate,
        });

        // Remove a senha antes de devolver os dados (Segurança)
        const { passwordHash, ...userSafe } = updatedUser;
        
        return res.json(userSafe);

    } catch (error) {
        console.error("Erro no update de user:", error);
        return res.status(500).json({ error: "Erro ao atualizar perfil." });
    }
});



export default router;
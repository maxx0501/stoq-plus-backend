import { Router } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mailService } from '../lib/mail';
import crypto from 'crypto';
import { authMiddleware } from '../middlewares/auth'; 
import axios from 'axios';
import { LoginSchema, SignupSchema, ChangePasswordSchema } from '../lib/validation';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('❌ JWT_SECRET não definida em .env');
}

const SUPER_ADMIN_EMAILS = ['stoqplus@gmail.com'];

// --- 1. CADASTRO ---
router.post('/signup', async (req, res) => {
    try {
        // ✅ VALIDAR ENTRADA COM ZOD
        const validated = SignupSchema.parse(req.body);
        const { name, email, password } = validated;

        const userExists = await prisma.user.findUnique({ where: { email } });
        
        if (userExists) {
            if (!userExists.isVerified) {
                return res.status(409).json({ error: "E-mail cadastrado mas não verificado.", code: "EMAIL_NOT_VERIFIED_YET" });
            }
            return res.status(400).json({ error: "E-mail já está cadastrado." });
        }

        const hash = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email.toLowerCase());

        await prisma.user.create({
            data: { name, email, passwordHash: hash, isVerified: false, verificationToken, isSuperAdmin }
        });

        // ✅ CORREÇÃO: Usando await para o não cortar a execução em segundo plano
        await mailService.sendVerificationEmail(email, verificationToken);
        
        return res.status(201).json({ message: "Usuário criado. Verifique seu e-mail." });
    } catch (error: any) {
        // ✅ NÃO EXPOR DETALHES DE ERRO
        if (error.name === 'ZodError') {
            return res.status(400).json({ error: error.errors[0]?.message || "Validação falhou" });
        }
        console.error('Signup error:', error);
        return res.status(500).json({ error: "Erro ao criar conta." });
    }
});

// --- 2. REENVIAR CÓDIGO ---
router.post('/resend-code', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
        if (user.isVerified) return res.status(400).json({ error: "Conta já verificada." });

        const newVerificationToken = crypto.randomBytes(32).toString('hex');
        await prisma.user.update({ where: { id: user.id }, data: { verificationToken: newVerificationToken } });
        
        // ✅ CORREÇÃO: Usando await para o  não cortar a execução em segundo plano
        await mailService.sendVerificationEmail(user.email, newVerificationToken);

        return res.json({ message: "Código reenviado!" });
    } catch (error) {
        console.error('Resend code error:', error);
        return res.status(500).json({ error: "Erro ao reenviar código." });
    }
});

// --- 3. VERIFICAR EMAIL (POST - mais seguro que GET) ---
router.post('/verify', async (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token inválido" });
    }

    try {
        const user = await prisma.user.findFirst({ where: { verificationToken: token } });
        if (!user) {
            return res.status(400).json({ error: "Token expirado ou inválido" });
        }

        await prisma.user.update({ 
            where: { id: user.id }, 
            data: { isVerified: true, verificationToken: null } 
        });
        return res.json({ message: "Email verificado com sucesso!" });
    } catch (error) {
        console.error('Verify error:', error);
        return res.status(500).json({ error: "Erro ao validar email" });
    }
});

// --- 3B. VERIFICAR EMAIL (GET compatibilidade) - DEPRECADO ---
router.get('/verify', async (req, res) => {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Link inválido." });
    }

    try {
        const user = await prisma.user.findFirst({ where: { verificationToken: token } });
        if (!user) {
            return res.status(400).json({ error: "Link expirado. Use a opção 'Reenviar código'." });
        }

        await prisma.user.update({ where: { id: user.id }, data: { isVerified: true, verificationToken: null } });
        // ✅ REDIRECIONAR PARA FRONTEND - NÃO EXPOR TOKEN EM URL
        return res.redirect(`${process.env.FRONTEND_URL || 'https://stoqplus.com.br'}/login?verified=true`);
    } catch (error) {
        console.error('GET Verify error:', error);
        return res.status(500).json({ error: "Erro ao validar." });
    }
});

// --- 4. LOGIN ---
router.post('/login', async (req, res) => {
    try {
        // ✅ VALIDAR ENTRADA
        const validated = LoginSchema.parse(req.body);
        const { email, password } = validated;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // ⏱️ DELAY PARA EVITAR TIMING ATTACK
            await new Promise(r => setTimeout(r, 500));
            return res.status(400).json({ error: "Credenciais inválidas." });
        }
        if (!user.isVerified) {
            return res.status(403).json({ error: "Confirme seu e-mail.", code: "EMAIL_NOT_VERIFIED" });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            // ⏱️ DELAY PARA EVITAR TIMING ATTACK
            await new Promise(r => setTimeout(r, 500));
            return res.status(400).json({ error: "Credenciais inválidas." });
        }

        const storeLink = await prisma.storeUser.findFirst({ where: { userId: user.id }, include: { store: true } });
        const userRole = storeLink ? storeLink.role : 'USER';
        
        const token = jwt.sign(
            { userId: user.id, role: userRole, isSuperAdmin: user.isSuperAdmin, storeId: storeLink?.storeId }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );

        return res.json({ 
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                role: userRole, 
                isSuperAdmin: user.isSuperAdmin,
                plan: user.isSuperAdmin ? 'PRO' : (storeLink?.store?.plan || 'FREE'),
                storeCreatedAt: storeLink?.store?.createdAt,
                isSubscribed: user.isSuperAdmin ? true : (storeLink?.store?.isSubscribed || false),
                mustChangePassword: user.mustChangePassword
            }, token, storeId: storeLink?.storeId 
        });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ error: error.errors[0]?.message });
        }
        console.error('Login error:', error);
        return res.status(500).json({ error: "Erro no login." });
    }
});

// --- 6. EXCLUIR CONTA ---
router.delete('/me', authMiddleware, async (req, res) => {
    const userId = (req as any).user?.userId;

    if (!userId) return res.status(401).json({ error: "Não autorizado." });

    try {
        const storeLink = await prisma.storeUser.findFirst({
            where: { 
                userId: userId, 
                role: 'OWNER' 
            }
        });

        if (storeLink) {
            await prisma.store.delete({
                where: { id: storeLink.storeId }
            });
        }

        await prisma.user.delete({
            where: { id: userId }
        });

        return res.status(200).json({ message: "Conta excluída." });
    } catch (error: any) {
        console.error("Erro ao deletar conta:", error);
        return res.status(500).json({ error: "Erro interno ao excluir conta." });
    }
});

// --- 7. ROTA DE LOGIN GOOGLE ---
router.get('/google', (req, res) => {
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth`;
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'https://stoqplus.com.br/auth/google/callback',
        response_type: 'code',
        scope: 'profile email',
        access_type: 'offline',
        prompt: 'consent'
    });
    res.redirect(`${googleAuthUrl}?${params.toString()}`);
});

// --- 8. CALLBACK DO GOOGLE ---
router.get('/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: "Código não fornecido." });

    try {
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'https://stoqplus.com.br/auth/google/callback',
        });

        const { access_token } = tokenRes.data;
        const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const { email, name, picture } = userRes.data;

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: { name, email, passwordHash: '', isVerified: true, avatarUrl: picture }
            });
        }

        const storeLink = await prisma.storeUser.findFirst({ where: { userId: user.id } });
        const userRole = storeLink ? storeLink.role : 'USER';
        
        const token = jwt.sign(
            { userId: user.id, role: userRole, isSuperAdmin: user.isSuperAdmin, storeId: storeLink?.storeId }, 
            JWT_SECRET!, 
            { expiresIn: '7d' }
        );

        // ✅ ARMAZENAR TOKEN SEGURAMENTE (httpOnly em produção)
        const frontendUrl = process.env.FRONTEND_URL || 'https://stoqplus.com.br';
        // Em produção, usar cookies httpOnly. Por enquanto redirecionar com token em sessão
        return res.redirect(`${frontendUrl}/login?google_token=${token}&user_name=${encodeURIComponent(user.name)}`);

    } catch (error) {
        console.error("Erro no Google Auth:", error);
        const frontendUrl = process.env.FRONTEND_URL || 'https://stoqplus.com.br';
        return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
});

// --- 9. ROTA DE VERIFICAÇÃO DE SESSÃO (GET /me) ---
router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });

    const [, token] = authHeader.split(' ');

    try {
        const decoded = jwt.verify(token, JWT_SECRET!) as any;
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        const storeLink = await prisma.storeUser.findFirst({ where: { userId: user.id } });
        const store = storeLink ? await prisma.store.findUnique({ where: { id: storeLink.storeId } }) : null;

        return res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: storeLink?.role || 'USER',
                avatarUrl: user.avatarUrl,
                isSuperAdmin: user.isSuperAdmin,
                plan: user.isSuperAdmin ? 'PRO' : (store?.plan || 'FREE'),
                storeCreatedAt: store?.createdAt,
                isSubscribed: user.isSuperAdmin ? true : (store?.isSubscribed || false),
                mustChangePassword: user.mustChangePassword
            },
            store: store ? { id: store.id, name: store.name } : null
        });

    } catch (err) {
        return res.status(401).json({ error: 'Token inválido' });
    }
});

// --- 10. ESQUECI MINHA SENHA (FORGOT PASSWORD) ---
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: "E-mail é obrigatório." });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user) {
            // 🔒 Não revelar se o usuário existe ou não (segurança)
            return res.status(200).json({ message: "Se o e-mail existe em nossos registros, você receberá um link para redefinir sua senha." });
        }

        // 🔐 Gerar token de recuperação com validade de 1 hora
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetPasswordToken: resetTokenHash,
                resetPasswordExpires: expiresAt
            }
        });

        // 📧 Enviar e-mail com link de recuperação
        await mailService.sendPasswordResetEmail(email, resetToken);

        return res.status(200).json({ message: "E-mail de recuperação enviado." });
    } catch (error: any) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ error: "Erro ao processar recuperação de senha." });
    }
});

// --- 11. VALIDAR TOKEN DE RECUPERAÇÃO ---
router.get('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const user = await prisma.user.findFirst({
            where: {
                resetPasswordToken: resetTokenHash,
                resetPasswordExpires: {
                    gt: new Date() // Token ainda válido?
                }
            }
        });

        if (!user) {
            return res.status(400).json({ error: "Token inválido ou expirado." });
        }

        return res.status(200).json({ 
            message: "Token válido. Você pode redefinir sua senha.",
            email: user.email
        });
    } catch (error: any) {
        console.error('Reset password validation error:', error);
        return res.status(500).json({ error: "Erro ao validar token." });
    }
});

// --- 12. REDEFINIR SENHA (RESET PASSWORD) ---
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: "Token e nova senha são obrigatórios." });
        }

        const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const user = await prisma.user.findFirst({
            where: {
                resetPasswordToken: resetTokenHash,
                resetPasswordExpires: {
                    gt: new Date() // Token ainda válido?
                }
            }
        });

        if (!user) {
            return res.status(400).json({ error: "Token inválido ou expirado." });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
        }

        // 🔐 Hash da nova senha
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        });

        return res.status(200).json({ message: "Senha redefinida com sucesso. Faça login com sua nova senha." });
    } catch (error: any) {
        console.error('Reset password error:', error);
        return res.status(500).json({ error: "Erro ao redefinir senha." });
    }
});

// Função para gerar senha temporária forte
function generateTemporaryPassword(): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    let password = '';
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    const all = upper + lower + numbers + symbols;
    for (let i = 0; i < 6; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }
    
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// --- CHANGE OWN PASSWORD (Qualquer usuário logado) ---
router.put('/change-password', authMiddleware, async (req, res) => {
    try {
        const currentUser = (req as any).user;
        const { currentPassword, newPassword } = req.body;

        // 🔍 DEBUG
        console.log('🔐 Change Password Request:', { userId: currentUser.userId, email: currentUser.email });

        // ✅ Validar entrada
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Forneça senha atual e nova senha." });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
        }

        // ✅ Buscar usuário
        const user = await prisma.user.findUnique({ where: { id: currentUser.userId } });
        if (!user) {
            console.error('❌ Usuário não encontrado para ID:', currentUser.userId);
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        // ✅ Verificar senha atual
        const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!validPassword) {
            return res.status(400).json({ error: "Senha atual incorreta." });
        }

        // ✅ Hash da nova senha
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // ✅ Atualizar senha
        await prisma.user.update({
            where: { id: currentUser.userId },
            data: { passwordHash: hashedPassword, mustChangePassword: false }
        });

        return res.status(200).json({ message: "Senha alterada com sucesso." });
    } catch (error: any) {
        console.error('Change password error:', error);
        return res.status(500).json({ error: "Erro ao alterar senha." });
    }
});

// --- ADMIN RESET PASSWORD (Super Admin ou OWNER da loja)---
router.put('/admin-reset-password/:storeUserId', authMiddleware, async (req, res) => {
    try {
        // ✅ Super Admin ou OWNER da loja podem redefinir senhas
        const currentUser = (req as any).user;
        
        if (!currentUser || (!currentUser.isSuperAdmin && currentUser.role !== 'OWNER')) {
            return res.status(403).json({ error: "Apenas Super Admin ou proprietário da loja podem redefinir senhas." });
        }

        const storeUserId = String(req.params.storeUserId);
        const { newPassword } = req.body;

        // ✅ Validar nova senha
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
        }

        // ✅ Buscar o StoreUser para pegar o userId
        const storeUser = await prisma.storeUser.findUnique({ 
            where: { id: storeUserId },
            include: { user: true }
        });
        
        if (!storeUser) {
            return res.status(404).json({ error: "Membro não encontrado." });
        }

        // ✅ Hash da nova senha
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // ✅ Atualizar usuário com nova senha e marcar para mudar na próxima vez
        const updatedUser = await prisma.user.update({
            where: { id: storeUser.userId },
            data: {
                passwordHash: hashedPassword,
                mustChangePassword: true,
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        });

        return res.status(200).json({ 
            message: "Senha alterada. O usuário deve mudar sua senha no próximo login.",
            user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email }
        });
    } catch (error: any) {
        console.error('Admin reset password error:', error);
        return res.status(500).json({ error: "Erro ao redefinir senha do usuário." });
    }
});

// --- FORÇAR MUDANÇA DE SENHA (Quando mustChangePassword é true)---
router.put('/force-change-password', authMiddleware, async (req, res) => {
    try {
        const currentUser = (req as any).user;
        const { newPassword } = req.body;

        // ✅ Validar entrada
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres." });
        }

        // ✅ Buscar usuário
        const user = await prisma.user.findUnique({ where: { id: currentUser.userId } });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        // ✅ Verificar se realmente precisa mudar (segurança)
        if (!user.mustChangePassword) {
            return res.status(403).json({ error: "Mudança de senha não é obrigatória." });
        }

        // ✅ Hash da nova senha
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // ✅ Atualizar senha e liberar acesso
        await prisma.user.update({
            where: { id: currentUser.userId },
            data: { passwordHash: hashedPassword, mustChangePassword: false }
        });

        return res.status(200).json({ message: "Senha alterada com sucesso!" });
    } catch (error: any) {
        console.error('Force change password error:', error);
        return res.status(500).json({ error: "Erro ao alterar senha." });
    }
});

export default router;
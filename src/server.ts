import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'path';

// Importação das Rotas
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/products.routes';
import salesRoutes from './routes/sales.routes';
import customersRoutes from './routes/customers.routes';
import paymentRoutes from './routes/payments.routes';
import teamRoutes from './routes/team.routes';
import cashflowRoutes from './routes/cashflow.routes';
import dashboardRoutes from './routes/dashboard.routes';
import statsRoutes from './routes/stats.routes';
import reportsRoutes from './routes/reports.routes';
import expensesRoutes from './routes/expenses.routes';
import storeRoutes from './routes/store.routes';
import userRoutes from './routes/users.routes';
import adminRoutes from './routes/admin.routes';

const app = express();
const PORT = process.env.PORT || 3333;
const prisma = new PrismaClient();

// ===== CONFIGURAÇÃO ANTES DE MIDDLEWARE =====
// IMPORTANTE: Deve ser ANTES do rate limiter!
app.set('trust proxy', 1);

// ===== MIDDLEWARE DE SEGURANÇAaa =====

// 1. Helmet - Adiciona headers de segurança
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:']
        }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    xssFilter: true
}));

// 2. CORS - Restrito a origens conhecidas
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS não permitido'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

// 3. Rate Limiting - Proteção contra força bruta
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limita 100 requisições por IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        return res.status(429).json({ error: 'Muitas requisições, tente novamente mais tarde' });
    }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // Apenas 5 tentativas de login
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        return res.status(429).json({ error: 'Muitas tentativas de login, tente novamente em 15 minutos' });
    }
});

app.use(express.json({ limit: '10mb' })); // Reduzido de 50mb para 10mb
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(limiter); // Aplicar rate limiter globalmente

// ===== PROTEÇÃO DE ROTAS SENSÍVEIS =====
app.use('/auth/login', loginLimiter);
app.use('/auth/signup', loginLimiter);

// ===== ARQUIVO ESTÁTICO (UPLOADS) =====

// --- MAPA DE ROTAS ---

app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/stock', productRoutes); 
app.use('/sales', salesRoutes);
app.use('/customers', customersRoutes);
app.use('/payments', paymentRoutes);
app.use('/team', teamRoutes);
app.use('/sellers', teamRoutes);
app.use('/cashflow', cashflowRoutes);
app.use('/reports', reportsRoutes);
app.use('/expenses', expensesRoutes);
app.use('/stores', storeRoutes);
app.use('/users', userRoutes);
app.use('/admin', adminRoutes);

// Rotas de Dashboard (Compatibilidade)
app.use('/dashboard-metrics', dashboardRoutes); 
app.use('/my-sales-metrics', statsRoutes);      

// Rota de Teste
app.get('/', (req, res) => res.send('🚀 Stoq+ API Modular Rodando e Corrigida!'));

// --- SETUP INICIAL ---
const setupSuperAdmin = async () => {
    const email = process.env.ADMIN_EMAIL || 'admin@stoqplus.com';
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
        console.warn('⚠️ AVISO: ADMIN_PASSWORD não definida em .env - Admin não será criado');
        return;
    }

    try {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (!existing) {
            const hash = await bcrypt.hash(password, 10);
            
            const user = await prisma.user.create({ 
                data: { 
                    name: 'CEO/Admin', 
                    email, 
                    passwordHash: hash, 
                    isSuperAdmin: true,
                    isVerified: true 
                } 
            });

            const store = await prisma.store.create({ data: { name: 'Stoq+ HQ', plan: 'PRO' } });
            
            await prisma.storeUser.create({ 
                data: { 
                    userId: user.id, 
                    storeId: store.id, 
                    role: 'OWNER' 
                } 
            });
            
            console.log(`✅ Admin criado com sucesso: ${email}`);
        }
    } catch (e) { 
        console.error("❌ Setup error:", e); 
    }
};

app.listen(PORT, async () => {
    console.log(`🚀 Server rodando na porta ${PORT}`);
    console.log(`🔒 Segurança: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    await setupSuperAdmin();
});
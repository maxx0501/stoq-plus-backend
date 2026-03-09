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
    'http://localhost:5174',
    'http://localhost:3000',
    'https://stoqplus.com.br',
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

// 3. Rate Limiting - Proteção contra força bruta (RELAXADO PARA PRODUÇAO)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 300, // Aumentado de 100 para 300 requisições por IP (permite até 20 req/min)
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limit para requisições GET de leitura (lista, detalhes)
        return req.method === 'GET' && !req.path.includes('/auth');
    },
    handler: (req, res) => {
        console.warn(`⚠️ Rate limit excedido para IP: ${req.ip}`);
        return res.status(429).json({ error: 'Muitas requisições, tente novamente mais tarde' });
    }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Aumentado de 5 para 10 tentativas de login
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        return res.status(429).json({ error: 'Muitas tentativas de login, tente novamente em 15 minutos' });
    }
});

app.use(express.json({ limit: '50mb' })); // Aumentado para suportar uploads maiores
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(limiter); // Aplicar rate limiter globalmente

// ===== PROTEÇÃO DE ROTAS SENSÍVEIS =====
app.use('/auth/login', loginLimiter);
app.use('/auth/signup', loginLimiter);

// ===== ARQUIVO ESTÁTICO (UPLOADS) =====
// Serve arquivos estáticos da pasta 'uploads' com CORS permitido
app.use('/uploads', (req, res, next) => {
    // Headers CORS para permitir acesso de qualquer origem
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Vary', 'Origin');
    res.header('Cache-Control', 'public, max-age=3600');
    
    // Responde a requisições OPTIONS (CORS preflight)
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
}, express.static(path.join(__dirname, '..', 'uploads'), {
    setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', '*');
    }
}));
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

// --- ERROR HANDLER GLOBAL ---
app.use((err: any, req: any, res: any, next: any) => {
    console.error('❌ Erro não tratado:', err);
    
    // CORS errors
    if (err.message === 'CORS não permitido') {
        return res.status(403).json({ error: 'CORS não permitido' });
    }
    
    // Prisma errors
    if (err.code === 'P1000') {
        return res.status(503).json({ error: 'Banco de dados indisponível, tente novamente' });
    }
    if (err.code === 'P2002') {
        return res.status(400).json({ error: 'Registro duplicado' });
    }
    if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Registro não encontrado' });
    }
    
    // Default error
    return res.status(500).json({ error: 'Erro interno do servidor' });
});

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
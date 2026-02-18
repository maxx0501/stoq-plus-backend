# 🔒 Segurança - Stoq+ Backend

## Melhorias de Segurança Implementadas (Fev 2026)

### 1. **Headers de Segurança HTTP** (Helmet.js)
- ✅ Content-Security-Policy para evitar XSS
- ✅ X-Frame-Options para prevenir clickjacking
- ✅ HSTS para forçar HTTPS em produção
- ✅ Proteção contra MIME type sniffing

**Arquivo**: `src/server.ts` (linhas 23-34)

### 2. **CORS Restritivo**
- ✅ Apenas origens whitelist têm acesso
- ✅ Credenciais ativadas apenas para origens confiáveis
- ✅ Suporta `FRONTEND_URL` via variável de ambiente

**Arquivo**: `src/server.ts` (linhas 36-49)

### 3. **Rate Limiting**
- ✅ Proteção contra força bruta (100 req/IP a cada 15 min)
- ✅ Limite mais restritivo para login (5 tentativas/15 min)
- ✅ Limite para signup

**Arquivo**: `src/server.ts` (linhas 51-75)

### 4. **Validação de Entrada (Zod)**
- ✅ Schemas para login, signup, mudança de senha
- ✅ Requisitos de senha forte (8+ chars, maiúsculas, minúsculas, números, especiais)
- ✅ Validação automática em todas as rotas de auth

**Arquivo**: `src/lib/validation.ts`

### 5. **Proteção contra Timing Attacks**
- ✅ Delay de 500ms após falha de login
- ✅ Identical error messages para user not found vs invalid password

**Arquivo**: `src/routes/auth.routes.ts` (linhas 131-139)

### 6. **JWT Seguro**
- ✅ JWT_SECRET obrigatória em `.env` (sem fallback inseguro)
- ✅ Falha na inicialização se JWT_SECRET não estiver definida
- ✅ Token expira em 7 dias

**Arquivo**: `src/middlewares/auth.ts` (linhas 1-10)

### 7. **Sem Senhas Hardcoded**
- ✅ Scripts atualizados para usar variáveis de ambiente
- ✅ Admin criado apenas com `ADMIN_PASSWORD` definida
- ✅ `.env.example` fornecido como template

**Arquivos**: 
- `backend/.env.example`
- `scripts/setAdminPassword.js`
- `scripts/checkPassword.js`

### 8. **Redução de Limite de Upload**
- ✅ Reduzido de 50MB para 10MB para evitar DoS

**Arquivo**: `src/server.ts` (linha 74)

### 9. **Tratamento Seguro de Erros**
- ✅ Mensagens de erro genéricas em produção
- ✅ Stack traces apenas em development
- ✅ Logging de erros completo em console

**Arquivo**: `src/routes/auth.routes.ts`

## Configuração Necessária

### `.env` do Backend
```env
# Segurança OBRIGATÓRIA
JWT_SECRET="[gere com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"]"
ADMIN_EMAIL="seu_email@empresa.com"
ADMIN_PASSWORD="SenhaForte!123@"
NODE_ENV="production"
FRONTEND_URL="https://seu-frontend.com"

# Banco de Dados
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Email
EMAIL_USER="seu_email@gmail.com"
EMAIL_PASS="app_password_gmail_16_caracteres"

# Pagamentos
MP_ACCESS_TOKEN="seu_token"

# OAuth (opcional)
GOOGLE_CLIENT_ID="seu_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="seu_secret"
GOOGLE_REDIRECT_URI="https://seu-backend.com/auth/google/callback"
```

## Testes de Segurança

### 1. Rate Limiting
```bash
# Fazer 6+ requisições de login rapidamente
# A 6ª deve retornar: 429 (Too Many Requests)
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'
```

### 2. CORS
```bash
# Requisição de origem não autorizada deve retornar erro
curl -H "Origin: http://attacker.com" http://localhost:3333/auth/me
```

### 3. Validação de Senha
```bash
# Senha fraca deve ser rejeitada
curl -X POST http://localhost:3333/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"123"}'
# Response: 400 - "Deve conter letra maiúscula"
```

### 4. JWT Expirado
```bash
# Requisição com JWT antigo/inválido
curl -H "Authorization: Bearer eyJhb..." http://localhost:3333/admin/dashboard
# Response: 401 - "Token expirado"
```

## Checklist de Deploy para Produção

- [ ] JWT_SECRET gerada e configurada em `.env`
- [ ] ADMIN_PASSWORD configurada
- [ ] NODE_ENV=production
- [ ] FRONTEND_URL apontando para seu domínio
- [ ] HTTPS/SSL configurado
- [ ] Banco de dados com backup
- [ ] Email configurado e testado
- [ ] Google OAuth URIs registradas (se usar)
- [ ] Rate limiting testado
- [ ] CORS whitelist atualizado

## Vulnerabilidades Conhecidas (Futuros)

- [ ] Two-Factor Authentication (2FA)
- [ ] Audit logging completo
- [ ] Encryption em campos sensíveis
- [ ] CSRF tokens para forms (atualmente via JWT)
- [ ] API versioning
- [ ] DDoS protection (CloudFlare)

## Referências

- Helmet.js: https://helmetjs.github.io/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Node.js Security Best Practices: https://nodejs.org/en/docs/guides/security/

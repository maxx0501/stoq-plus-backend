# Stoq+ Backend

API REST em Express 5 + TypeScript com PostgreSQL via Prisma ORM.

## Setup

```bash
npm install
cp .env.example .env     # Preencha com suas credenciais
npx prisma migrate dev   # Cria tabelas no banco
npm run dev              # http://localhost:3333
```

Na primeira execucao, o sistema cria automaticamente um Super Admin com as credenciais definidas em `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

## Estrutura

```
src/
├── server.ts              # Entry point, middleware, mapa de rotas
├── routes/
│   ├── auth.routes.ts     # Login, signup, OAuth, verificacao, reset
│   ├── products.routes.ts # CRUD produtos + estoque
│   ├── sales.routes.ts    # Vendas, dividas, metricas
│   ├── customers.routes.ts# Clientes, historico
│   ├── team.routes.ts     # Membros da equipe, permissoes
│   ├── cashflow.routes.ts # Abertura/fechamento de caixa
│   ├── expenses.routes.ts # Despesas, recorrencia
│   ├── payments.routes.ts # Mercado Pago checkout + webhook
│   ├── dashboard.routes.ts# Metricas do dashboard
│   ├── stats.routes.ts    # Estatisticas do vendedor
│   ├── reports.routes.ts  # Relatorios
│   ├── store.routes.ts    # Criacao de loja
│   ├── users.routes.ts    # Perfil do usuario
│   └── admin.routes.ts    # Painel Super Admin
├── middlewares/
│   └── auth.ts            # authMiddleware (JWT) + checkSubscription
├── lib/
│   ├── prisma.ts          # Prisma client singleton
│   ├── mercadopago.ts     # MP SDK config + helpers
│   ├── mail.ts            # Envio de email
│   └── validation.ts      # Schemas Zod (signup, login, email)
└── prisma/
    └── schema.prisma      # Schema do banco
```

## API Endpoints

Todas as rotas (exceto auth e payments/webhook) requerem header `Authorization: Bearer <token>`.

### Auth (`/auth`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/auth/signup` | Cadastro com verificacao por email |
| POST | `/auth/login` | Login (retorna JWT 7 dias) |
| GET | `/auth/me` | Dados do usuario logado |
| POST | `/auth/verify` | Verificar email com token |
| POST | `/auth/forgot-password` | Solicitar reset de senha |
| POST | `/auth/reset-password` | Resetar senha com token |
| PUT | `/auth/change-password` | Alterar senha (autenticado) |
| POST | `/auth/force-change-password` | Primeiro acesso - senha obrigatoria |
| GET | `/auth/google` | Iniciar OAuth Google |
| GET | `/auth/google/callback` | Callback do Google |

### Produtos (`/products`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/products` | Listar produtos da loja |
| POST | `/products` | Criar produto |
| PUT | `/products/:id` | Atualizar produto |
| DELETE | `/products/:id` | Deletar produto |
| POST | `/products/entry` | Entrada/baixa de estoque |
| GET | `/products/history` | Historico de movimentacoes |

### Vendas (`/sales`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/sales` | Registrar venda |
| GET | `/sales/debts` | Listar dividas (fiado) |
| PUT | `/sales/:id/pay` | Marcar divida como paga |

### Clientes (`/customers`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/customers` | Listar clientes |
| POST | `/customers` | Criar cliente |
| PUT | `/customers/:id` | Atualizar cliente |
| DELETE | `/customers/:id` | Deletar cliente |

### Equipe (`/team`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/team` | Listar membros |
| POST | `/team` | Criar vendedor/gerente |
| PUT | `/team/member/:id` | Atualizar permissoes |
| DELETE | `/team/:id` | Remover membro |

### Pagamentos (`/payments`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/payments/create-checkout` | Gerar link Mercado Pago |
| POST | `/payments/webhook` | Webhook MP (aprovacao, estorno) |
| POST | `/payments/cancel-subscription` | Cancelar assinatura |
| GET | `/payments/success` | Redirect pos-pagamento |
| GET | `/payments/failure` | Redirect pos-falha |

### Fluxo de Caixa (`/cashflow`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/cashflow/open` | Abrir caixa |
| POST | `/cashflow/close` | Fechar caixa |
| POST | `/cashflow/supply` | Suprimento |
| POST | `/cashflow/bleed` | Sangria |
| GET | `/cashflow/current` | Caixa atual |
| GET | `/cashflow/history` | Historico |

### Despesas (`/expenses`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/expenses` | Listar despesas |
| POST | `/expenses` | Criar (com recorrencia opcional) |
| PATCH | `/expenses/:id/toggle` | Marcar pago/pendente |
| DELETE | `/expenses/:id` | Deletar |

### Admin (`/admin`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/admin/dashboard` | Metricas globais (requer isSuperAdmin) |
| DELETE | `/admin/store/:id` | Deletar loja |

## Middleware

### `authMiddleware`
Valida JWT no header `Authorization: Bearer <token>`. Seta `req.user` com `userId`, `storeId`, `role`, etc.

### `checkSubscription`
Aplicado nas rotas protegidas. Verifica:
1. Se o plano e PRO e a assinatura esta ativa (nao expirou)
2. Se o plano e FREE e o trial de 30 dias nao acabou
3. Sellers nao sao bloqueados

Se expirou, retorna `403` com mensagem.

## Seguranca

- Helmet.js (CSP, HSTS, X-Frame-Options: DENY)
- CORS restritivo com whitelist de origens
- Rate limiting: 300 req/15min geral, 10 tentativas de login
- Validacao de input com Zod
- Senhas com bcrypt (salt 10)
- JWT sem fallback (obrigatorio em .env)

## Banco de Dados

PostgreSQL com Prisma ORM. Schema em `prisma/schema.prisma`.

### Modelos principais
- **User** - Conta do usuario (email, senha, avatar, superAdmin)
- **Store** - Loja (plano, assinatura, dados MP)
- **StoreUser** - Relacao N:N com role (OWNER, MANAGER, SELLER) e permissoes
- **Product** - Produto com preco, custo, estoque, imagem
- **Sale / SaleItem** - Venda com itens, forma de pagamento, status
- **Customer** - Cliente com CPF, telefone, endereco
- **CashFlow / CashFlowMovement** - Controle de caixa
- **Expense** - Despesas com vencimento e status de pagamento

### Comandos uteis
```bash
npx prisma studio       # Interface visual do banco
npx prisma migrate dev  # Aplicar migrations
npx prisma db push      # Sync rapido (sem migration)
npx prisma generate     # Regenerar client
```

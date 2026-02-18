import { z } from 'zod';

// ===== SCHEMAS DE VALIDAÇÃO =====

// Auth
export const LoginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Senha muito curta')
});

export const SignupSchema = z.object({
    name: z.string().min(2, 'Nome muito curto'),
    email: z.string().email('Email inválido'),
    password: z.string()
        .min(8, 'Senha deve ter no mínimo 8 caracteres')
        .regex(/[A-Z]/, 'Deve conter letra maiúscula')
        .regex(/[a-z]/, 'Deve conter letra minúscula')
        .regex(/[0-9]/, 'Deve conter número')
        .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Deve conter caractere especial')
});

export const ChangePasswordSchema = z.object({
    newPassword: z.string()
        .min(8, 'Senha deve ter no mínimo 8 caracteres')
        .regex(/[A-Z]/, 'Deve conter letra maiúscula')
        .regex(/[a-z]/, 'Deve conter letra minúscula')
        .regex(/[0-9]/, 'Deve conter número')
        .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Deve conter caractere especial')
});

// Products
export const CreateProductSchema = z.object({
    name: z.string().min(1, 'Nome obrigatório').max(255),
    price: z.number().positive('Preço deve ser positivo'),
    stock: z.number().int().min(0, 'Estoque não pode ser negativo'),
    description: z.string().max(1000).optional(),
    category: z.string().max(100).optional(),
    imageUrl: z.string().url().optional().or(z.string().max(0))
});

export const UpdateProductSchema = CreateProductSchema.partial();

// Sales
export const CreateSaleSchema = z.object({
    items: z.array(z.object({
        productId: z.string().uuid('ID de produto inválido'),
        quantity: z.number().int().positive()
    })).min(1, 'Venda deve ter pelo menos 1 item'),
    customerId: z.string().uuid().optional().nullable(),
    paymentMethod: z.enum(['MONEY', 'CARD', 'PIX', 'CREDIT_STORE']).optional()
});

// Customers
export const CreateCustomerSchema = z.object({
    name: z.string().min(2, 'Nome muito curto').max(255),
    email: z.string().email().optional().or(z.string().max(0)),
    phone: z.string().max(20).optional(),
    cpf: z.string().max(20).optional(),
    address: z.string().max(500).optional()
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

// Store
export const CreateStoreSchema = z.object({
    name: z.string().min(2, 'Nome muito curto').max(255)
});

// Team
export const CreateTeamMemberSchema = z.object({
    name: z.string().min(2).max(255),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['SELLER', 'MANAGER']).optional(),
    canSell: z.boolean().optional(),
    canManageProducts: z.boolean().optional()
});

export const UpdateTeamMemberSchema = z.object({
    canSell: z.boolean().optional(),
    canManageProducts: z.boolean().optional()
});

// Validation helper
export const validateRequest = async <T>(schema: z.ZodSchema, data: any): Promise<T> => {
    try {
        return schema.parse(data) as T;
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new ValidationError(error.issues[0]?.message || 'Validação falhou');
        }
        throw error;
    }
};

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

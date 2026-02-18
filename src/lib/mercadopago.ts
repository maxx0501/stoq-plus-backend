import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import 'dotenv/config'; // <--- Garante que o arquivo .env seja lido aqui

// O "|| ''" evita erro se o token não for carregado (mas vai dar erro na API se estiver vazio)
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';

if (!ACCESS_TOKEN) {
  console.error("❌ ERRO CRÍTICO: Token do Mercado Pago não encontrado no .env!");
}

// 1. Configuração Inicial
export const mpClient = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });

// 2. Instâncias
export const payment = new Payment(mpClient);
export const preference = new Preference(mpClient);

console.log("✅ Mercado Pago Configurado!");
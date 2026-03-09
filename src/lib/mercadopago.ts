import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import axios from 'axios';
import 'dotenv/config';

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const MP_ENVIRONMENT = process.env.MP_ENVIRONMENT || 'sandbox'; // sandbox ou production
// IMPORTANTE: MercadoPago usa a mesma URL para ambos (sandbox vs production)
// A diferença está no TOKEN (APP_USR para sandbox, diferente para production)
const MP_API_URL = 'https://api.mercadopago.com.br';

if (!ACCESS_TOKEN) {
  console.error("❌ ERRO CRÍTICO: Token do Mercado Pago não encontrado no .env!");
} else {
  console.log(`✅ MP_ACCESS_TOKEN configurado (${MP_ENVIRONMENT})`);
}

// 1. Configuração Inicial
export const mpClient = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });

// 2. Instâncias da SDK
export const payment = new Payment(mpClient);
export const preference = new Preference(mpClient);

// 3. Subscriptions API (via axios - não está na SDK por padrão)
export const subscriptions = {
  async createPreapproval(data: any) {
    try {
      console.log(`📤 POST ${MP_API_URL}/preapprovals`);
      const response = await axios.post(
        `${MP_API_URL}/preapprovals`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao criar preapproval:', error.response?.data || error.message);
      throw error;
    }
  },
  
  async getPreapproval(id: string) {
    try {
      const response = await axios.get(
        `${MP_API_URL}/preapprovals/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar preapproval:', error.response?.data || error.message);
      throw error;
    }
  },

  async cancelPreapproval(id: string) {
    try {
      const response = await axios.put(
        `${MP_API_URL}/preapprovals/${id}`,
        { status: 'cancelled' },
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao cancelar preapproval:', error.response?.data || error.message);
      throw error;
    }
  }
};

console.log(`✅ Mercado Pago Configurado (${MP_ENVIRONMENT}) - API: ${MP_API_URL}`);
import { Router } from 'express';
import { preference, payment } from '../lib/mercadopago'; 
import { prisma } from '../lib/prisma'; 

const router = Router();

// ⚠️ Mantenha seu link do Ngrok aqui
const SEU_LINK_NGROK = "https://vertie-estival-bulah.ngrok-free.dev"; 

router.get('/success', (req, res) => {
    return res.redirect('http://localhost:5173/dashboard?status=success');
});

router.get('/failure', (req, res) => {
    return res.redirect('http://localhost:5173/subscription?status=failure');
});

// --- 1. CHECKOUT ---
router.post('/create-checkout', async (req, res) => {
    try {
        const { planType, storeId } = req.body;

        if (!storeId) return res.status(400).json({ error: "Store ID is required" });

        const isYearly = planType === 'yearly';
        
        // --- PREÇO ATUALIZADO ---
        // Anual: 389.90 (Conforme solicitado)
        const price = isYearly ? 389.90 : 49.90;
        
        const title = isYearly 
            ? "Stoq+ Anual (Acesso total por 12 meses)" 
            : "Stoq+ Mensal (Acesso por 30 dias)";

        const backUrls = {
            success: `${SEU_LINK_NGROK}/payments/success`,
            failure: `${SEU_LINK_NGROK}/payments/failure`,
            pending: `${SEU_LINK_NGROK}/payments/failure`
        };

        const result = await preference.create({
            body: {
                items: [
                    {
                        id: planType,
                        title: title,
                        quantity: 1,
                        unit_price: price,
                        currency_id: 'BRL',
                    },
                ],
                external_reference: storeId,
                back_urls: backUrls,
                auto_return: "approved",
                statement_descriptor: "STOQ PLUS"
            }
        });

        return res.json({ init_point: result.init_point });
    } catch (error: any) {
        console.error("❌ Erro MP:", error);
        return res.status(500).json({ error: "Erro ao criar preferência", details: error.message });
    }
});

// --- 2. WEBHOOK (Mantido igual) ---
router.post('/webhook', async (req, res) => {
    try {
        const { type, data } = req.body;
        const id = data?.id || req.query.id; 

        if (id && (type === 'payment' || req.query.topic === 'payment')) {
            const paymentInfo = await payment.get({ id: String(id) });
            
            if (paymentInfo.status === 'approved') {
                const storeId = paymentInfo.external_reference;
                const amount = paymentInfo.transaction_amount || 0;
                
                // Se pagou mais de 100 reais, assume anual
                const daysToAdd = amount > 100 ? 365 : 30; 

                const newExpiryDate = new Date();
                newExpiryDate.setDate(newExpiryDate.getDate() + daysToAdd);

                if (storeId) {
                    await prisma.store.update({
                        where: { id: storeId },
                        data: { 
                            plan: 'PRO',
                            subscriptionExpiresAt: newExpiryDate 
                        }
                    });
                }
            }
        }
        return res.status(200).send("OK");
    } catch (error) {
        console.error("Erro no Webhook:", error);
        return res.status(500).send();
    }
});

export default router;
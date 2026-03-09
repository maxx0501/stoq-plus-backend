import { Router } from 'express';
import { preference, payment } from '../lib/mercadopago'; 
import { prisma } from '../lib/prisma';

const router = Router();

const SEU_LINK_NGROK = "https://stoqplus.com.br";
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const MP_API = 'https://api.mercadopago.com'; 

router.get('/success', (req, res) => {
    return res.redirect('https://stoqplus.com.br/dashboard?status=success');
});

router.get('/failure', (req, res) => {
    return res.redirect('https://stoqplus.com.br/subscription?status=failure');
});

// --- 1. CHECKOUT SIMPLES - PREFERENCES API ---
router.post('/create-checkout', async (req, res) => {
    try {
        const { storeId } = req.body;

        if (!storeId) return res.status(400).json({ error: "Store ID is required" });

        const store = await prisma.store.findUnique({ where: { id: storeId } });
        if (!store) return res.status(404).json({ error: "Loja não encontrada" });

        console.log(`\n💳 Criando checkout para loja: ${store.name}`);

        // Primeira compra = R$ 1,00 (teste)
        // Depois recicla como R$ 49,90/mês
        const firstPrice = store.isSubscribed ? 49.90 : 1.00;
        const description = store.isSubscribed 
            ? `Renovação - Stoq+ Premium` 
            : `Teste Grátis - Stoq+ Premium (depois R$ 49,90/mês)`;

        // Criar preference
        const preferenceData = {
            items: [
                {
                    title: `Stoq+ Premium - Assinatura Mensal`,
                    description: description,
                    unit_price: firstPrice,
                    quantity: 1,
                    currency_id: 'BRL'
                }
            ],
            payer: {
                name: store.name
            },
            external_reference: storeId,
            back_urls: {
                success: `https://stoqplus.com.br/dashboard?status=success`,
                failure: `https://stoqplus.com.br/subscription?status=failure`,
                pending: `https://stoqplus.com.br/subscription?status=pending`
            },
            auto_return: 'approved',
            notification_url: 'https://stoqplus.com.br/payments/webhook'
        };

        const response = await preference.create({ body: preferenceData });

        console.log(`✅ Preference criada: ${response.id}`);
        console.log(`   Preço: R$ ${firstPrice}`);
        console.log(`   Init Point: ${response.init_point}\n`);

        return res.json({
            init_point: response.init_point,
            preference_id: response.id
        });

    } catch (error: any) {
        console.error("❌ Erro ao criar preferência:", error.message);
        return res.status(500).json({
            error: "Erro ao criar preferência",
            details: error.message
        });
    }
});

// --- 2. WEBHOOK (Processa pagamentos) ---
router.post('/webhook', async (req, res) => {
    try {
        const { type, data } = req.body;
        const id = data?.id || req.query.id;

        console.log(`\n📩 Webhook recebido - Tipo: ${type}, ID: ${id}`);

        if (type === 'payment' || req.query.topic === 'payment') {
            if (!id) return res.status(200).send("OK");

            const paymentInfo = await payment.get({ id: String(id) });
            
            if (paymentInfo.status === 'approved') {
                const storeId = paymentInfo.external_reference;
                const amount = paymentInfo.transaction_amount || 0;

                console.log(`✅ Pagamento aprovado`);
                console.log(`   Loja: ${storeId}`);
                console.log(`   Valor: R$ ${amount}`);

                const store = await prisma.store.findUnique({ where: { id: storeId } });

                if (store) {
                    // Ativa assinatura
                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + 30); // Plus 30 dias

                    await prisma.store.update({
                        where: { id: storeId },
                        data: {
                            isSubscribed: true,
                            subscriptionExpiresAt: expiryDate
                        }
                    });

                    console.log(`✅ Assinatura ativada até: ${expiryDate.toLocaleDateString('pt-BR')}`);
                }
            }
        }

        return res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Erro no Webhook:", error);
        return res.status(500).send();
    }
});

export default router;
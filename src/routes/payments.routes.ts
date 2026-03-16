import { Router } from 'express';
import { preference, payment } from '../lib/mercadopago'; 
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/success', (_req, res) => {
    return res.redirect('https://stoqplus.com.br/dashboard?status=success');
});

router.get('/failure', (_req, res) => {
    return res.redirect('https://stoqplus.com.br/subscription?status=failure');
});

// --- 1. CHECKOUT SIMPLES - PREFERENCES API ---
router.post('/create-checkout', async (req, res) => {
    try {
        const { storeId } = req.body;

        if (!storeId) return res.status(400).json({ error: "Store ID is required" });

        const store = await prisma.store.findUnique({ where: { id: storeId } });
        if (!store) return res.status(404).json({ error: "Loja não encontrada" });

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
                    id: 'stoq-premium',
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

        return res.json({
            init_point: response.init_point,
            preference_id: response.id
        });

    } catch (error: any) {
        console.error("Erro ao criar preferencia:", error.message);
        return res.status(500).json({
            error: "Erro ao criar preferência"
        });
    }
});

// --- 2. WEBHOOK (Processa pagamentos) ---
router.post('/webhook', async (req, res) => {
    try {
        const { type, data } = req.body;
        const id = data?.id || req.query.id;

        console.log(`Webhook recebido - Tipo: ${type}, ID: ${id}`);

        if (type === 'payment' || req.query.topic === 'payment') {
            if (!id) return res.status(200).send("OK");

            const paymentInfo = await payment.get({ id: String(id) });
            
            const storeId = paymentInfo.external_reference;
            const amount = paymentInfo.transaction_amount || 0;

            if (paymentInfo.status === 'approved') {
                console.log(`Pagamento aprovado - Loja: ${storeId}, Valor: R$ ${amount}`);

                const store = await prisma.store.findUnique({ where: { id: storeId } });

                if (store) {
                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + 30);

                    await prisma.store.update({
                        where: { id: storeId },
                        data: {
                            plan: 'PRO',
                            isSubscribed: true,
                            subscriptionExpiresAt: expiryDate
                        }
                    });

                    console.log(`Assinatura ativada ate: ${expiryDate.toLocaleDateString('pt-BR')}`);
                }
            } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
                console.log(`Pagamento ${paymentInfo.status} - Loja: ${storeId}`);
            } else if (paymentInfo.status === 'refunded' || paymentInfo.status === 'charged_back') {
                console.log(`Chargeback/Reembolso - Loja: ${storeId}`);
                if (storeId) {
                    await prisma.store.update({
                        where: { id: storeId },
                        data: { isSubscribed: false, plan: 'FREE' }
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

// --- 3. CANCELAR ASSINATURA ---
router.post('/cancel-subscription', async (req, res) => {
    try {
        const { storeId } = req.body;
        if (!storeId) return res.status(400).json({ error: "Store ID é obrigatório" });

        const store = await prisma.store.findUnique({ where: { id: storeId } });
        if (!store) return res.status(404).json({ error: "Loja não encontrada" });

        if (!store.isSubscribed) {
            return res.status(400).json({ error: "Esta loja não possui assinatura ativa" });
        }

        await prisma.store.update({
            where: { id: storeId },
            data: {
                isSubscribed: false,
                plan: 'FREE'
            }
        });

        return res.json({ message: "Assinatura cancelada com sucesso" });
    } catch (error) {
        console.error("Erro ao cancelar assinatura:", error);
        return res.status(500).json({ error: "Erro ao cancelar assinatura" });
    }
});

export default router;
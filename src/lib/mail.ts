import nodemailer from 'nodemailer';

class MailService {
    private transporter: any;

    constructor() {
        const resendApiKey = process.env.RESEND_API_KEY;
        
        if (!resendApiKey) {
            console.error('❌ ERRO CRÍTICO: RESEND_API_KEY não configurada no .env!');
        }

        // ✅ Configuração oficial do Resend via SMTP
        this.transporter = nodemailer.createTransport({
            host: 'smtp.resend.com',
            port: 465,
            secure: true, // true para porta 465
            auth: {
                user: 'resend', // O usuário no Resend é LITERALMENTE a palavra 'resend'
                pass: resendApiKey // A chave que você gerou: re_...
            }
        } as any);
    }

    async sendVerificationEmail(to: string, token: string) {
        // Agora pega a URL oficial de produção
        const backendUrl = process.env.API_URL || 'https://api.stoqplus.com.br';
        const verificationLink = `${backendUrl}/auth/verify?token=${token}`;

        console.log('📤 INICIANDO ENVIO DE EMAIL VIA RESEND');
        console.log('  Para:', to);

        try {
            const mailOptions = {
                // 🚨 O PULO DO GATO: O remetente TEM que ser do seu domínio!
                from: '"Stoq+ Sistemas" <nao-responda@stoqplus.com.br>',
                to,
                subject: 'Bem-vindo ao Stoq+! Confirme sua conta',
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px;">
                        
                        <div style="background-color: #0f172a; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; font-style: italic;">Stoq<span style="color: #2563eb;">+</span></h1>
                        </div>

                        <div style="padding: 32px 24px; text-align: center;">
                            <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Confirme seu endereço de e-mail</h2>
                            <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
                                Olá! Falta apenas um passo para você começar a usar o <strong>Stoq+</strong>. 
                                Clique no botão abaixo para ativar sua conta imediatamente.
                            </p>

                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                                <tr>
                                    <td align="center" bgcolor="#2563eb" style="border-radius: 8px;">
                                        <a href="${verificationLink}" target="_blank" style="font-size: 16px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; border: 1px solid #2563eb; display: inline-block; font-weight: bold;">
                                            Confirmar Minha Conta
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                        </div>

                        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                                © 2026 Stoq+ Sistemas. Você recebeu este e-mail porque se cadastrou em nossa plataforma.
                            </p>
                        </div>
                    </div>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ E-mail enviado com sucesso pelo Resend!');
            console.log('  Message ID:', info.messageId);
            
        } catch (error: any) {
            console.error('❌ ERRO AO ENVIAR E-MAIL:');
            console.error('  Mensagem:', error.message);
            throw new Error(`Email service error: ${error.message}`);
        }
    }
}

export const mailService = new MailService();
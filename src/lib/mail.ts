import nodemailer from 'nodemailer';

class MailService {
    private transporter: any;

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    async sendVerificationEmail(to: string, token: string) {
        const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:3333';
        const verificationLink = `${backendUrl}/auth/verify?token=${token}`;

        try {
            console.log(`📤 Conectando ao Gmail para enviar e-mail para: ${to}...`);

            await this.transporter.sendMail({
                from: `"Stoq+ " <${process.env.EMAIL_USER}>`,
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
            });

            console.log('✅ E-mail enviado com sucesso via Gmail!');
            
        } catch (error) {
            console.error('❌ Erro crítico ao enviar e-mail:', error);
            throw new Error('Não foi possível enviar o e-mail de confirmação.');
        }
    }
}

export const mailService = new MailService();
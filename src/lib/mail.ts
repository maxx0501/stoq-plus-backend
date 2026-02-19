import nodemailer from 'nodemailer';

class MailService {
    private transporter: any;

    constructor() {
        // DEBUG: Verificar se credenciais existem
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('❌ ERRO CRÍTICO: EMAIL_USER ou EMAIL_PASS não configurados!');
            console.error('EMAIL_USER:', process.env.EMAIL_USER ? '✓ Configurado' : '✗ NÃO CONFIGURADO');
            console.error('EMAIL_PASS:', process.env.EMAIL_PASS ? '✓ Configurado' : '✗ NÃO CONFIGURADO');
        }

        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            // Opções de timeout maiores para evitar problemas de conexão
            connectionTimeout: 10000,
            socketTimeout: 10000
        });
    }

    async sendVerificationEmail(to: string, token: string) {
        const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:3333';
        const verificationLink = `${backendUrl}/auth/verify?token=${token}`;

        console.log('📤 INICIANDO ENVIO DE EMAIL');
        console.log('  Para:', to);
        console.log('  Link:', verificationLink);
        console.log('  Email de:', process.env.EMAIL_USER);

        try {
            // Testa a conexão com o servidor SMTP ANTES de enviar
            console.log('🔍 Verificando conexão com Gmail...');
            await this.transporter.verify();
            console.log('✅ Conexão com Gmail verificada!');

            const mailOptions = {
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
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ E-mail enviado com sucesso! ID:', info.messageId);
            console.log('  Resposta:', info.response);
            
        } catch (error: any) {
            console.error('❌ ERRO CRÍTICO AO ENVIAR E-MAIL:');
            console.error('  Tipo:', error.code || error.name);
            console.error('  Mensagem:', error.message);
            console.error('  Detalhes:', error);
            
            // Se o erro for de autenticação, dar orientações
            if (error.message.includes('Invalid login') || error.message.includes('535')) {
                console.error('\n⚠️ POSSÍVEL SOLUÇÃO:');
                console.error('  1. Verifique EMAIL_USER no .env');
                console.error('  2. Se usa 2FA, gere uma "App Password" em https://myaccount.google.com/apppasswords');
                console.error('  3. USE A APP PASSWORD (16 caracteres), não sua senha do Gmail');
                console.error('  4. Copie SEM ESPAÇOS: abcdefghijklmnop');
            }
            
            throw new Error(`Email service unavailable: ${error.message}`);
        }
    }
}

export const mailService = new MailService();
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

    async sendPasswordResetEmail(to: string, token: string) {
        const backendUrl = process.env.API_URL || 'https://api.stoqplus.com.br';
        const frontendUrl = process.env.FRONTEND_URL || 'https://stoqplus.com.br';
        const resetLink = `${frontendUrl}/reset-password?token=${token}`;

        console.log('📤 INICIANDO ENVIO DE EMAIL DE RECUPERAÇÃO DE SENHA');
        console.log('  Para:', to);

        try {
            const mailOptions = {
                from: '"Stoq+ Sistemas" <nao-responda@stoqplus.com.br>',
                to,
                subject: 'Recupere sua senha no Stoq+',
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px;">
                        
                        <div style="background-color: #0f172a; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; font-style: italic;">Stoq<span style="color: #2563eb;">+</span></h1>
                        </div>

                        <div style="padding: 32px 24px; text-align: center;">
                            <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Redefinir Sua Senha</h2>
                            <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
                                Recebemos um pedido para redefinir a senha da sua conta. Se não foi você, ignore este e-mail. Caso contrário, clique no botão abaixo para criar uma nova senha.
                            </p>

                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                                <tr>
                                    <td align="center" bgcolor="#2563eb" style="border-radius: 8px;">
                                        <a href="${resetLink}" target="_blank" style="font-size: 16px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; border: 1px solid #2563eb; display: inline-block; font-weight: bold;">
                                            Redefinir Minha Senha
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #94a3b8; font-size: 12px; margin-top: 20px; margin-bottom: 0;">
                                Este link expira em 1 hora. Se não conseguir redefini-la no prazo, solicite um novo link.
                            </p>
                            
                        </div>

                        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                                © 2026 Stoq+ Sistemas. Se você não solicitou uma redefinição de senha, ignore este e-mail.
                            </p>
                        </div>
                    </div>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ E-mail de recuperação enviado com sucesso!');
            console.log('  Message ID:', info.messageId);
            
        } catch (error: any) {
            console.error('❌ ERRO AO ENVIAR E-MAIL:');
            console.error('  Mensagem:', error.message);
            throw new Error(`Email service error: ${error.message}`);
        }
    }

    async sendTemporaryPasswordEmail(to: string, userName: string, temporaryPassword: string) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://stoqplus.com.br';
        const loginLink = `${frontendUrl}/login`;

        console.log('📤 ENVIANDO EMAIL COM SENHA TEMPORÁRIA');
        console.log('  Para:', to);
        console.log('  Nome:', userName);

        try {
            const mailOptions = {
                from: '"Stoq+ Sistemas" <nao-responda@stoqplus.com.br>',
                to,
                subject: 'Sua senha foi redefinida - Stoq+',
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px;">
                        
                        <div style="background-color: #0f172a; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; font-style: italic;">Stoq<span style="color: #2563eb;">+</span></h1>
                        </div>

                        <div style="padding: 32px 24px; text-align: center;">
                            <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Senha Redefinida</h2>
                            <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
                                Olá <strong>${userName}</strong>, sua senha foi redefinida pelo gerenciador da sua conta.
                            </p>

                            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
                                <p style="color: #475569; margin: 0 0 12px 0; font-size: 14px;">Sua senha temporária é:</p>
                                <p style="background-color: #ffffff; padding: 12px; border-radius: 6px; color: #0f172a; font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold; margin: 0; letter-spacing: 1px;">${temporaryPassword}</p>
                            </div>

                            <div style="background-color: #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #dc2626;">
                                <p style="color: #991b1b; font-size: 13px; margin: 0;">
                                    <strong>⚠️ IMPORTANTE:</strong> Esta é uma senha temporária. Você será obrigado a criar uma nova senha no seu primeiro acesso.
                                </p>
                            </div>

                            <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
                                Para fazer login, acesse o link abaixo e use a senha temporária fornecida acima.
                            </p>

                            <a href="${loginLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">Acessar Stoq+</a>

                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">

                            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                                Dúvidas? Contate seu gerenciador de conta.
                            </p>
                        </div>

                        <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                            <p style="color: #64748b; font-size: 12px; margin: 0;">
                                © 2026 Stoq+ Sistemas. Todos os direitos reservados.
                            </p>
                        </div>
                    </div>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ E-mail com senha temporária enviado com sucesso!');
            console.log('  Message ID:', info.messageId);
            
        } catch (error: any) {
            console.error('❌ ERRO AO ENVIAR E-MAIL:');
            console.error('  Mensagem:', error.message);
            throw new Error(`Email service error: ${error.message}`);
        }
    }
}

export const mailService = new MailService();
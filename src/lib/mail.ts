import nodemailer from 'nodemailer';

class MailService {
    private transporter: any;

    constructor() {
        // DEBUG: Verificar se credenciais existem
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;
        
        if (!emailUser || !emailPass) {
            console.error('❌ ERRO CRÍTICO: EMAIL_USER ou EMAIL_PASS não configurados!');
            console.error('EMAIL_USER:', emailUser ? '✓ Configurado' : '✗ NÃO CONFIGURADO');
            console.error('EMAIL_PASS:', emailPass ? '✓ Configurado' : '✗ NÃO CONFIGURADO');
        }

        // ✅ USAR CONFIGURAÇÃO MANUAL COM FAMILY: 4 (IPv4 ONLY)
        // Render bloqueia IPv6 para Gmail, então forçamos IPv4
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            family: 4, // Force IPv4 only - Render blocks IPv6
            auth: {
                user: emailUser,
                pass: emailPass
            },
            connectionTimeout: 10000,
            socketTimeout: 10000,
            logger: true,
            debug: process.env.NODE_ENV === 'development'
        } as any);
    }

    async sendVerificationEmail(to: string, token: string) {
        const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:3333';
        const verificationLink = `${backendUrl}/auth/verify?token=${token}`;

        console.log('📤 INICIANDO ENVIO DE EMAIL');
        console.log('  Para:', to);
        console.log('  Backend URL:', backendUrl);
        console.log('  Email de:', process.env.EMAIL_USER);

        try {
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
            console.log('✅ E-mail enviado com sucesso!');
            console.log('  Message ID:', info.messageId);
            
        } catch (error: any) {
            console.error('❌ ERRO CRÍTICO AO ENVIAR E-MAIL:');
            console.error('  Código:', error.code);
            console.error('  Nome:', error.name);
            console.error('  Mensagem:', error.message);
            console.error('  Stack:', error.stack);
            
            // Diagnosticar o problema específico
            if (error.code === 'EAUTH' || error.message.includes('Invalid login') || error.message.includes('535')) {
                console.error('\n🔐 ERRO DE AUTENTICAÇÃO - Possíveis causas:');
                console.error('  1. EMAIL_PASS tem espaços (remova: "abc d efg" → "abcdefg")');
                console.error('  2. EMAIL_USER incorreto');
                console.error('  3. 2FA não ativado no Gmail (precisa 2FA para App Password)');
                console.error('  4. App Password não foi criada corretamente');
                console.error('\n✅ Solução:');
                console.error('  a) https://myaccount.google.com/apppasswords');
                console.error('  b) Gere para: Mail + Windows Computer');
                console.error('  c) Google gera: "abc d efg h ijk l mno p"');
                console.error('  d) COPIE SEM ESPAÇOS: abcdefghijklmnop');
                console.error('  e) Cole no Render Environment → EMAIL_PASS');
                console.error('  f) Click Manual Deploy');
            }
            
            throw new Error(`Email service error: ${error.message}`);
        }
    }
}

export const mailService = new MailService();
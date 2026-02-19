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
            console.error('\n⚠️ VERIFIQUE:');
            console.error('  1. No Render Dashboard → Environment → EMAIL_USER e EMAIL_PASS existem?');
            console.error('  2. EMAIL_PASS tem espaços? Remova: abcd efgh → abcdefgh');
            console.error('  3. Fez "Manual Deploy" após adicionar as variáveis?');
        }

        // ✅ CONFIGURAÇÃO CORRETA PARA GMAIL COM PORTA 465 + SSL
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', // Gmail SMTP sempre usa isso
            port: 465, // Porta para SSL (CORRETO)
            secure: true, // OBRIGATÓRIO com porta 465
            auth: {
                user: emailUser,
                pass: emailPass // Deve ser App Password gerada no Gmail, SEM ESPAÇOS
            },
            connectionTimeout: 15000, // 15 segundos
            socketTimeout: 15000,
            logger: true, // Enable logger para debug
            debug: true // Enable debug output
        });
    }

    async sendVerificationEmail(to: string, token: string) {
        const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:3333';
        const verificationLink = `${backendUrl}/auth/verify?token=${token}`;

        console.log('📤 INICIANDO ENVIO DE EMAIL');
        console.log('  Para:', to);
        console.log('  Link:', verificationLink);
        console.log('  Email de:', process.env.EMAIL_USER);
        console.log('  SMTP Host:', 'smtp.gmail.com:465 (SSL)');

        try {
            // Testa a conexão com o servidor SMTP ANTES de enviar
            console.log('🔍 Verificando conexão com SMTP Gmail...');
            await this.transporter.verify();
            console.log('✅ Conexão SMTP verificada com sucesso!');

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
            console.log('  Response:', info.response);
            
        } catch (error: any) {
            console.error('❌ ERRO AO ENVIAR E-MAIL:');
            console.error('  Código:', error.code);
            console.error('  Nome:', error.name);
            console.error('  Mensagem:', error.message);
            console.error('  Stack:', error.stack);
            
            // Diagnosticar o problema específico
            if (error.code === 'EAUTH') {
                console.error('\n🔐 ERRO DE AUTENTICAÇÃO - Possíveis causas:');
                console.error('  ❌ EMAIL_PASS com espaços (remova: "abc d efg" → "abcdefg")');
                console.error('  ❌ EMAIL_USER incorreto');
                console.error('  ❌ App Password não foi gerada (precisa de 2FA no Gmail)');
                console.error('  ❌ Credenciais não foram atualizadas no Render');
                console.error('\n✅ Solução:');
                console.error('  1. Acesse: https://myaccount.google.com/apppasswords');
                console.error('  2. Gere uma App Password para "Mail" e "Windows Computer"');
                console.error('  3. COPIE SEM ESPAÇOS (16 caracteres seguidos)');
                console.error('  4. Cole no Render → Environment → EMAIL_PASS');
                console.error('  5. Click "Manual Deploy"');
            }
            
            throw new Error(`Email service error: ${error.message}`);
        }
    }
}

export const mailService = new MailService();
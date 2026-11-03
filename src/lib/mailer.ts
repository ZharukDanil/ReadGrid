import nodemailer from 'nodemailer';

type MailOptions = { to: string; subject: string; text: string; html: string };

// 1. Тестовий транспортер (для локальної розробки)
let etherealTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

async function getEtherealTransporter() {
  if (!etherealTransporter) {
    const account = await nodemailer.createTestAccount();
    etherealTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: account.user, pass: account.pass },
    });
  }
  return etherealTransporter;
}

// 2. Продакшн транспортер (ініціалізується ОДИН раз при запуску сервера)
const productionTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMail({ to, subject, text, html }: MailOptions) {
  // На Render за замовчуванням має бути 'smtp'
  const mode = process.env.MAIL_MODE || 'smtp'; 

  try {
    if (mode === 'console') {
      console.log('\n📧 [MAIL:console]');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Text:', text, '\n');
      return { success: true, mode: 'console' };
    }

    if (mode === 'ethereal') {
      const transporter = await getEtherealTransporter();
      const info = await transporter.sendMail({
        from: '"ReadGrid Test" <test@readgrid.local>',
        to, subject, text, html,
      });
      console.log('\n📧 [MAIL:ethereal] Переглянути лист:', nodemailer.getTestMessageUrl(info), '\n');
      return { success: true, mode: 'ethereal', url: nodemailer.getTestMessageUrl(info) };
    }

    // --- ПРОДАКШН РЕЖИМ (SMTP) ---
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || '"ReadGrid" <support@yourdomain.com>';

    const info = await productionTransporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html,
    });

    console.log(`\n✅ [MAIL:smtp] Лист успішно надіслано на ${to}. MessageId: ${info.messageId}\n`);
    return { success: true, mode: 'smtp', messageId: info.messageId };

  } catch (error) {
    console.error('\n❌ [MAIL:ERROR] Критична помилка відправки листа:', error);
    throw error; 
  }
}
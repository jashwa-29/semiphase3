import nodemailer, { Transporter } from 'nodemailer';

interface EmailOptions {
  email: string;
  subject: string;
  message: string;
  html?: string;
}

// Singleton transporter — created once and reused across all email calls
let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465', // true for 465, false for 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      pool: true,          // keep SMTP connection alive between sends
      maxConnections: 5,   // max 5 simultaneous connections
      maxMessages: 100,    // reuse a connection up to 100 messages
    });
  }
  return transporter;
};

const sendEmail = async (options: EmailOptions): Promise<void> => {
  const mailOptions = {
    from: `"${process.env.FROM_NAME || 'Semi Phase 3'}" <${process.env.EMAIL_FROM}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const info = await getTransporter().sendMail(mailOptions);
  console.log(`[Email] Message sent: ${info.messageId}`);
};

export default sendEmail;

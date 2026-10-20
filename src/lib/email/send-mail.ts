import "server-only";
import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

// Se arma una sola vez por proceso (no en cada envío) -- mismo patrón que
// cualquier cliente reusable. Credenciales de una cuenta de Google
// Workspace vía contraseña de aplicación (no la contraseña normal de la
// cuenta), nunca hardcodeadas.
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendMailWithAttachment(opts: {
  to: string;
  subject: string;
  text: string;
  attachment: { filename: string; content: Buffer };
}) {
  await getTransporter().sendMail({
    from: `"Control de Planta" <${process.env.GMAIL_USER}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    attachments: [
      {
        filename: opts.attachment.filename,
        content: opts.attachment.content,
      },
    ],
  });
}

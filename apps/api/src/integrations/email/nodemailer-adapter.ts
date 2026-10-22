import nodemailer from "nodemailer";
import type { MailTransport } from "@purchase-orders/library";

export function createDevelopmentCaptureTransport(): MailTransport {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  return {
    async sendMail(message) {
      return transport.sendMail({ from: "purchase-orders@example.test", ...message });
    }
  };
}

export function createConfiguredSmtpTransport(): MailTransport | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  return {
    async sendMail(message) {
      return transport.sendMail({ from: process.env.SMTP_FROM ?? user, ...message });
    }
  };
}

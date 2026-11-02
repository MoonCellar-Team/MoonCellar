import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { renderLetter, type ILetter } from "./mail.letter";

export interface ISendLetterOptions {
  to: string;
  subject: string;
  letter: ILetter;
}

const DEFAULT_FROM = "MoonCellar <noreply@mooncellar.space>";
const DEFAULT_PORT = 587;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>("SMTP_HOST")?.trim();
    const user = this.config.get<string>("SMTP_USER")?.trim();
    const password = this.config.get<string>("SMTP_PASSWORD");

    this.from = this.config.get<string>("SMTP_FROM")?.trim() || DEFAULT_FROM;
    this.replyTo =
      this.config.get<string>("SMTP_REPLY_TO")?.trim() || undefined;

    this.transport = host
      ? nodemailer.createTransport({
          host,
          port: Number(this.config.get<string>("SMTP_PORT")) || DEFAULT_PORT,
          secure: this.config.get<string>("SMTP_SECURE") === "true",
          auth: user && password ? { user, pass: password } : undefined,
        })
      : null;
  }

  get isEnabled(): boolean {
    return this.transport !== null;
  }

  async send({ to, subject, letter }: ISendLetterOptions): Promise<void> {
    if (!this.transport) {
      throw new ServiceUnavailableException(
        "Mail is not configured: set SMTP_HOST to the mail container"
      );
    }

    const { html, text } = renderLetter(letter);

    await this.transport.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text,
      replyTo: this.replyTo,
    });

    this.logger.log(`Sent "${subject}" to ${to}`);
  }
}

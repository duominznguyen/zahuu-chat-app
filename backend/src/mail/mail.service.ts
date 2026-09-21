import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export type OtpPurpose = 'REGISTER' | 'RESET_PASSWORD';

const OTP_COPY: Record<OtpPurpose, { subject: string; intro: string }> = {
  REGISTER: {
    subject: 'Mã xác thực đăng ký Zahuu Chat',
    intro: 'Dùng mã dưới đây để hoàn tất đăng ký tài khoản',
  },
  RESET_PASSWORD: {
    subject: 'Mã đặt lại mật khẩu Zahuu Chat',
    intro: 'Dùng mã dưới đây để đặt lại mật khẩu',
  },
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const port = Number(config.getOrThrow('SMTP_PORT'));
    this.transporter = createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: {
        user: config.getOrThrow<string>('SMTP_USER'),
        pass: config.getOrThrow<string>('SMTP_PASS'),
      },
    });
    this.from = config.getOrThrow<string>('MAIL_FROM');
  }

  async send(to: string, subject: string, html: string) {
    await this.transporter.sendMail({ from: this.from, to, subject, html });
    this.logger.log(`Đã gửi mail "${subject}" tới ${to}`);
  }

  sendOtp(to: string, code: string, purpose: OtpPurpose, ttlMinutes = 10) {
    const { subject, intro } = OTP_COPY[purpose];
    const html = `
      <div style="font-family:sans-serif;max-width:420px">
        <p>${intro}:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</p>
        <p>Mã có hiệu lực trong ${ttlMinutes} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      </div>`;
    return this.send(to, subject, html);
  }
}

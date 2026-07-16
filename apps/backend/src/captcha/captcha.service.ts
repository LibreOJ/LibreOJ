import { BadRequestException, Injectable } from "@nestjs/common";

import { CaptchaAction } from "./captcha-action.enum";
import { isCaptchaResult } from "./captcha-result.interface";
import { TencentCaptchaService } from "./tencent-captcha.service";
import { TurnstileService } from "./turnstile.service";

import { ConfigService } from "../config/config.service";

@Injectable()
export class CaptchaService {
  constructor(
    private readonly configService: ConfigService,
    private readonly turnstileService: TurnstileService,
    private readonly tencentCaptchaService: TencentCaptchaService
  ) {}

  get isConfigured(): boolean {
    const { turnstile, tencentCaptcha } = this.configService.config.security.captcha;
    return !!(turnstile || tencentCaptcha);
  }

  async verify(serializedResult: string | undefined, action: CaptchaAction, remoteIp: string): Promise<boolean> {
    if (!serializedResult) return false;

    let result: unknown;
    try {
      result = JSON.parse(serializedResult);
    } catch (error) {
      const exception = new BadRequestException("Captcha result is not valid JSON");
      Object.defineProperty(exception, "cause", { value: error });
      throw exception;
    }
    if (!isCaptchaResult(result)) throw new BadRequestException("Captcha result has an invalid shape");

    const config = this.configService.config.security.captcha;
    if ("turnstile" in result && config.turnstile) {
      return await this.turnstileService.verify(result.turnstile.token, action, remoteIp);
    }
    if ("tencentCaptcha" in result && config.tencentCaptcha) {
      return await this.tencentCaptchaService.verify(
        result.tencentCaptcha.ticket,
        result.tencentCaptcha.randStr,
        remoteIp
      );
    }
    return false;
  }
}

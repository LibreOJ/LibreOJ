import { Module } from "@nestjs/common";

import { CaptchaController } from "./captcha.controller";
import { CaptchaGuard } from "./captcha.guard";
import { CaptchaService } from "./captcha.service";
import { TencentCaptchaService } from "./tencent-captcha.service";
import { TurnstileService } from "./turnstile.service";

import { ConfigModule } from "../config/config.module";

@Module({
  imports: [ConfigModule],
  controllers: [CaptchaController],
  providers: [CaptchaGuard, CaptchaService, TencentCaptchaService, TurnstileService],
  exports: [CaptchaGuard, CaptchaService]
})
export class CaptchaModule {}

import { Module } from "@nestjs/common";

import { CaptchaController } from "./captcha.controller";
import { CaptchaGuard } from "./captcha.guard";
import { CaptchaService } from "./captcha.service";
import { TencentCaptchaService } from "./tencent-captcha.service";
import { TurnstileService } from "./turnstile.service";

import { ConfigModule } from "../config/config.module";
import { ProofOfWorkModule } from "../proof-of-work/proof-of-work.module";

@Module({
  imports: [ConfigModule, ProofOfWorkModule],
  controllers: [CaptchaController],
  providers: [CaptchaGuard, CaptchaService, TencentCaptchaService, TurnstileService],
  exports: [CaptchaGuard, CaptchaService]
})
export class CaptchaModule {}

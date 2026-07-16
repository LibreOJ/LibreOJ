import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import { ApiExtension, ApiForbiddenResponse, ApiHeader } from "@nestjs/swagger";

import { CAPTCHA_ACTION_METADATA, CaptchaAction } from "./captcha-action.enum";
import { CaptchaGuard } from "./captcha.guard";

export const Captcha = (action: CaptchaAction): MethodDecorator =>
  applyDecorators(
    SetMetadata(CAPTCHA_ACTION_METADATA, action),
    UseGuards(CaptchaGuard),
    ApiExtension("x-captcha-action", action),
    ApiHeader({
      name: "X-Captcha-Result",
      required: false,
      description: "Serialized Turnstile or Tencent Captcha result. Omitted when captcha is disabled or bypassed."
    }),
    ApiForbiddenResponse({ description: "Captcha verification failed." })
  );

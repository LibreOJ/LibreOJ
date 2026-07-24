import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { CAPTCHA_ACTION_METADATA, CaptchaAction } from "./captcha-action.enum";
import { CaptchaService } from "./captcha.service";

import { RequestWithSession } from "../auth/auth.middleware";

@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly captchaService: CaptchaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const action = this.reflector.get<CaptchaAction>(CAPTCHA_ACTION_METADATA, context.getHandler());
    if (!action) throw new Error("CaptchaGuard requires a captcha action");

    if (!this.captchaService.isConfigured || (await request.session?.userHasSkipRecaptchaPrivilege())) return true;

    const verified = await this.captchaService.verify(request.get("X-Captcha-Result"), action, request.ip);
    if (!verified) throw new ForbiddenException("Captcha verification failed");
    return true;
  }
}

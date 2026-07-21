import { Controller, Post, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { TencentCaptchaService } from "./tencent-captcha.service";
import { GetTencentCaptchaAppIdResponseDto } from "./dto/get-tencent-captcha-app-id-response.dto";

import { ProofOfWork } from "../proof-of-work/proof-of-work.decorator";
import { ProofOfWorkAction } from "../proof-of-work/proof-of-work-action.enum";

@ApiTags("Captcha")
@Controller("captcha")
export class CaptchaController {
  constructor(private readonly tencentCaptchaService: TencentCaptchaService) {}

  @Post("getTencentCaptchaAppId")
  @ProofOfWork(ProofOfWorkAction.AcquireTencentCaptcha)
  @ApiOperation({ summary: "Get a one-time, short-lived encrypted Tencent Captcha application ID." })
  getTencentCaptchaAppId(): GetTencentCaptchaAppIdResponseDto {
    if (!this.tencentCaptchaService.isConfigured)
      throw new ServiceUnavailableException("Tencent Captcha is not configured");
    return this.tencentCaptchaService.acquireEncryptedAppId();
  }
}

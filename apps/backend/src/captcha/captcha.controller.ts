import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { TencentCaptchaService } from "./tencent-captcha.service";
import { GetTencentCaptchaAppIdResponseDto } from "./dto/get-tencent-captcha-app-id-response.dto";

@ApiTags("Captcha")
@Controller("captcha")
export class CaptchaController {
  constructor(private readonly tencentCaptchaService: TencentCaptchaService) {}

  @Get("getTencentCaptchaAppId")
  @ApiOperation({ summary: "Get a short-lived encrypted Tencent Captcha application ID." })
  getTencentCaptchaAppId(): GetTencentCaptchaAppIdResponseDto {
    return this.tencentCaptchaService.isConfigured ? this.tencentCaptchaService.acquireEncryptedAppId() : {};
  }
}

import { ApiProperty } from "@nestjs/swagger";

export class GetTencentCaptchaAppIdResponseDto {
  @ApiProperty({ required: false })
  appId?: string;

  @ApiProperty({ required: false })
  encryptedAppId?: string;
}

import { ApiProperty } from "@nestjs/swagger";

export class GetTencentCaptchaAppIdResponseDto {
  @ApiProperty()
  appId: string;

  @ApiProperty()
  encryptedAppId: string;

  @ApiProperty({ enum: ["gcm"] })
  encryptedAppIdType: "gcm";
}

import { ApiProperty } from "@nestjs/swagger";

import { JudgeClientSystemInfo } from "@libreoj/judge-protocol";

export class JudgeClientInfoDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  key: string;

  @ApiProperty({ type: [String] })
  allowedHosts: string[];

  @ApiProperty()
  online: boolean;

  @ApiProperty()
  systemInfo?: JudgeClientSystemInfo;
}

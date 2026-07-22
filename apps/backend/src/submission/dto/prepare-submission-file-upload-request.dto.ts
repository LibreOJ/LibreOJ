import { ApiProperty } from "@nestjs/swagger";

import { IsInt, IsObject, Min } from "class-validator";

export class PrepareSubmissionFileUploadRequestDto {
  @ApiProperty()
  @IsInt()
  readonly problemId: number;

  @ApiProperty()
  @IsObject()
  readonly content: unknown;

  @ApiProperty()
  @IsInt()
  @Min(0)
  readonly fileSize: number;
}

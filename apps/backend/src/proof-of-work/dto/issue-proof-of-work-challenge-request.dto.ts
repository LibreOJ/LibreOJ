import { ApiProperty } from "@nestjs/swagger";

import { IsEnum } from "class-validator";

import { ProofOfWorkAction } from "../proof-of-work-action.enum";

export class IssueProofOfWorkChallengeRequestDto {
  @ApiProperty({ enum: ProofOfWorkAction })
  @IsEnum(ProofOfWorkAction)
  readonly action: ProofOfWorkAction;
}

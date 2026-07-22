import { ApiProperty } from "@nestjs/swagger";

export class IssueProofOfWorkChallengeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  randomData: string;

  @ApiProperty()
  difficulty: number;

  @ApiProperty()
  expiresAt: number;
}

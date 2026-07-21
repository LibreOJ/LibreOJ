import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { IssueProofOfWorkChallengeRequestDto } from "./dto/issue-proof-of-work-challenge-request.dto";
import { IssueProofOfWorkChallengeResponseDto } from "./dto/issue-proof-of-work-challenge-response.dto";
import { ProofOfWorkService } from "./proof-of-work.service";

import { RequestWithSession } from "../auth/auth.middleware";

@ApiTags("Proof of Work")
@Controller("proofOfWork")
export class ProofOfWorkController {
  constructor(private readonly proofOfWorkService: ProofOfWorkService) {}

  @Post("issueChallenge")
  @ApiOperation({ summary: "Issue an action-bound proof-of-work challenge." })
  async issueChallenge(
    @Req() request: RequestWithSession,
    @Body() body: IssueProofOfWorkChallengeRequestDto
  ): Promise<IssueProofOfWorkChallengeResponseDto> {
    return await this.proofOfWorkService.issueChallenge(body.action, {
      remoteIp: request.ip,
      sessionId: request.session?.sessionId,
      userId: request.session?.user?.id
    });
  }
}

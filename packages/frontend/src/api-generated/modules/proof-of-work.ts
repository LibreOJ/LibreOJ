// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const issueChallenge = createPostApi<
  ApiTypes.IssueProofOfWorkChallengeRequestDto,
  ApiTypes.IssueProofOfWorkChallengeResponseDto
>("proofOfWork/issueChallenge", {});

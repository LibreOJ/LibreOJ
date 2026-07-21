import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import { ApiExtension, ApiForbiddenResponse, ApiHeader } from "@nestjs/swagger";

import { PROOF_OF_WORK_ACTION_METADATA, ProofOfWorkAction } from "./proof-of-work-action.enum";
import { ProofOfWorkGuard } from "./proof-of-work.guard";

export const ProofOfWork = (action: ProofOfWorkAction): MethodDecorator =>
  applyDecorators(
    SetMetadata(PROOF_OF_WORK_ACTION_METADATA, action),
    UseGuards(ProofOfWorkGuard),
    ApiExtension("x-proof-of-work-action", action),
    ApiHeader({
      name: "X-Proof-Of-Work",
      required: true,
      description: "Serialized action-bound, single-use proof-of-work result."
    }),
    ApiForbiddenResponse({ description: "Proof of work verification failed." })
  );

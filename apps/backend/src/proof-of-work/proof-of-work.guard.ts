import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PROOF_OF_WORK_ACTION_METADATA, ProofOfWorkAction } from "./proof-of-work-action.enum";
import { ProofOfWorkService } from "./proof-of-work.service";

import { RequestWithSession } from "../auth/auth.middleware";

@Injectable()
export class ProofOfWorkGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly proofOfWorkService: ProofOfWorkService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const action = this.reflector.get<ProofOfWorkAction>(PROOF_OF_WORK_ACTION_METADATA, context.getHandler());
    if (!action) throw new Error("ProofOfWorkGuard requires a proof-of-work action");

    const verified = await this.proofOfWorkService.verify(request.get("X-Proof-Of-Work"), action, {
      remoteIp: request.ip,
      sessionId: request.session?.sessionId,
      userId: request.session?.user?.id
    });
    if (!verified) throw new ForbiddenException("Proof of work verification failed");
    return true;
  }
}

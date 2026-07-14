import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { GroupService } from "./group.service";
import { GroupController } from "./group.controller";
import { GroupEntity } from "./group.entity";
import { GroupMembershipEntity } from "./group-membership.entity";

import { AuditModule } from "../audit/audit.module";
import { UserModule } from "../user/user.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupEntity]),
    TypeOrmModule.forFeature([GroupMembershipEntity]),
    forwardRef(() => UserModule),
    forwardRef(() => AuditModule)
  ],
  providers: [GroupService],
  controllers: [GroupController],
  exports: [GroupService]
})
export class GroupModule {}

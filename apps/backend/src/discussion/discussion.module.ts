import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DiscussionService } from "./discussion.service";
import { DiscussionController } from "./discussion.controller";
import { DiscussionEntity } from "./discussion.entity";
import { DiscussionContentEntity } from "./discussion-content.entity";
import { DiscussionReplyEntity } from "./discussion-reply.entity";
import { DiscussionReactionEntity } from "./discussion-reaction.entity";
import { DiscussionReplyReactionEntity } from "./discussion-reply-reaction.entity";

import { ProblemModule } from "../problem/problem.module";
import { GroupModule } from "../group/group.module";
import { RedisModule } from "../redis/redis.module";
import { PermissionModule } from "../permission/permission.module";
import { AuditModule } from "../audit/audit.module";
import { UserModule } from "../user/user.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([DiscussionEntity]),
    TypeOrmModule.forFeature([DiscussionContentEntity]),
    TypeOrmModule.forFeature([DiscussionReplyEntity]),
    TypeOrmModule.forFeature([DiscussionReactionEntity]),
    TypeOrmModule.forFeature([DiscussionReplyReactionEntity]),
    forwardRef(() => UserModule),
    forwardRef(() => GroupModule),
    forwardRef(() => AuditModule),
    forwardRef(() => PermissionModule),
    forwardRef(() => ProblemModule),
    forwardRef(() => RedisModule)
  ],
  providers: [DiscussionService],
  controllers: [DiscussionController],
  exports: [DiscussionService]
})
export class DiscussionModule {}

import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LocalizedContentService } from "./localized-content.service";
import { LocalizedContentEntity } from "./localized-content.entity";

import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [TypeOrmModule.forFeature([LocalizedContentEntity]), forwardRef(() => RedisModule)],
  providers: [LocalizedContentService],
  exports: [LocalizedContentService]
})
export class LocalizedContentModule {}

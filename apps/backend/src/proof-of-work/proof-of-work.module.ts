import { Module } from "@nestjs/common";

import { ProofOfWorkController } from "./proof-of-work.controller";
import { ProofOfWorkGuard } from "./proof-of-work.guard";
import { ProofOfWorkService } from "./proof-of-work.service";

import { ConfigModule } from "../config/config.module";
import { MetricsModule } from "../metrics/metrics.module";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [ConfigModule, MetricsModule, RedisModule],
  controllers: [ProofOfWorkController],
  providers: [ProofOfWorkGuard, ProofOfWorkService],
  exports: [ProofOfWorkGuard, ProofOfWorkService]
})
export class ProofOfWorkModule {}

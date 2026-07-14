import { Module } from "@nestjs/common";

import { EventReportService } from "./event-report.service";

import { ClusterModule } from "../cluster/cluster.module";

@Module({
  imports: [ClusterModule],
  providers: [EventReportService],
  exports: [EventReportService]
})
export class EventReportModule {}

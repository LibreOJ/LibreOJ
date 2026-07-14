import { SubmissionStatus, OmittableString } from "@libreoj/judge-protocol";

import { JudgeTaskProgress } from "@/judge/judge-task-progress.interface";

export enum SubmissionProgressType {
  Preparing = "Preparing",
  Compiling = "Compiling",
  Running = "Running",
  Finished = "Finished"
}

export interface SubmissionTestcaseResult {}

interface TestcaseProgressReference {
  // If !waiting && !running && !testcaseHash, it's "Skipped"
  waiting?: boolean;
  running?: boolean;
  testcaseHash?: string;
}

export interface SubmissionProgress<TestcaseResult extends SubmissionTestcaseResult = SubmissionTestcaseResult>
  extends JudgeTaskProgress {
  progressType: SubmissionProgressType;

  // Only valid when finished
  status?: SubmissionStatus;
  score?: number;
  totalOccupiedTime?: number;

  compile?: {
    success: boolean;
    message: OmittableString;
  };

  systemMessage?: OmittableString;

  // testcaseHash
  // ->
  // result
  testcaseResult?: Record<string, TestcaseResult>;
  samples?: TestcaseProgressReference[];
  subtasks?: {
    score: number;
    fullScore: number;
    testcases: TestcaseProgressReference[];
  }[];
}

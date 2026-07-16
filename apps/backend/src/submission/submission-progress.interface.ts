import {
  SubmissionFinishedProgress as ProtocolSubmissionFinishedProgress,
  SubmissionProgress as ProtocolSubmissionProgress
} from "@libreoj/judge-protocol";

export { SubmissionProgressType } from "@libreoj/judge-protocol";

export interface SubmissionTestcaseResult {}

export type SubmissionProgress<TestcaseResult extends SubmissionTestcaseResult = SubmissionTestcaseResult> =
  ProtocolSubmissionProgress<TestcaseResult>;

export type SubmissionFinishedProgress<TestcaseResult extends SubmissionTestcaseResult = SubmissionTestcaseResult> =
  ProtocolSubmissionFinishedProgress<TestcaseResult>;

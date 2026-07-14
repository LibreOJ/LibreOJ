import { OmittableString } from "@libreoj/judge-protocol";

import { SubmissionTestcaseResult } from "../../../submission/submission-progress.interface";

// For subtasks and testcasese
export enum SubmissionTestcaseStatusSubmitAnswer {
  SystemError = "SystemError",

  FileError = "FileError",
  OutputLimitExceeded = "OutputLimitExceeded",

  PartiallyCorrect = "PartiallyCorrect",
  WrongAnswer = "WrongAnswer",
  Accepted = "Accepted",

  JudgementFailed = "JudgementFailed"
}

export interface SubmissionTestcaseResultSubmitAnswer extends SubmissionTestcaseResult {
  testcaseInfo: {
    inputFile: string;
    outputFile: string;
  };
  status: SubmissionTestcaseStatusSubmitAnswer;
  score: number;
  input?: OmittableString;
  output?: OmittableString;
  userOutput?: OmittableString;
  userOutputLength?: number;
  checkerMessage?: OmittableString;
  systemMessage?: OmittableString;
}

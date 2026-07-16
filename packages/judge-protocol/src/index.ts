export enum JudgeTaskType {
  Submission = "Submission"
}

export interface JudgeTaskMeta {
  taskId: string;
  type: JudgeTaskType;
}

export interface JudgeTaskPayload<ExtraInfo> extends JudgeTaskMeta {
  priorityType: number;
  priority: number;
  extraInfo: ExtraInfo;
}

export type OmittableString =
  | string
  | {
      data: string;
      omittedLength: number;
    };

export enum SubmissionStatus {
  Pending = "Pending",
  ConfigurationError = "ConfigurationError",
  SystemError = "SystemError",
  Canceled = "Canceled",
  CompilationError = "CompilationError",
  FileError = "FileError",
  RuntimeError = "RuntimeError",
  TimeLimitExceeded = "TimeLimitExceeded",
  MemoryLimitExceeded = "MemoryLimitExceeded",
  OutputLimitExceeded = "OutputLimitExceeded",
  PartiallyCorrect = "PartiallyCorrect",
  WrongAnswer = "WrongAnswer",
  Accepted = "Accepted",
  JudgementFailed = "JudgementFailed"
}

export enum SubmissionProgressType {
  Preparing = "Preparing",
  Compiling = "Compiling",
  Running = "Running",
  Finished = "Finished"
}

export interface SubmissionTestcaseProgressReference {
  waiting?: boolean;
  running?: boolean;
  testcaseHash?: string;
}

export interface SubmissionProgressDetails<TestcaseResult> {
  compile?: {
    success: boolean;
    message: OmittableString;
  };
  systemMessage?: OmittableString;
  testcaseResult?: Record<string, TestcaseResult>;
  samples?: SubmissionTestcaseProgressReference[];
  subtasks?: {
    score: number;
    fullScore: number;
    testcases: SubmissionTestcaseProgressReference[];
  }[];
}

export type SubmissionActiveProgress<TestcaseResult> = SubmissionProgressDetails<TestcaseResult> & {
  progressType: SubmissionProgressType.Preparing | SubmissionProgressType.Compiling | SubmissionProgressType.Running;
};

export type SubmissionFinishedProgress<TestcaseResult> = SubmissionProgressDetails<TestcaseResult> & {
  progressType: SubmissionProgressType.Finished;
  status: SubmissionStatus;
  score: number;
  totalOccupiedTime: number;
};

export type SubmissionProgress<TestcaseResult = unknown> =
  | SubmissionActiveProgress<TestcaseResult>
  | SubmissionFinishedProgress<TestcaseResult>;

export interface JudgeClientSystemInfo {
  os: string;
  kernel: string;
  arch: string;
  cpu: {
    model: string;
    flags: string;
    cache: Record<string, number>;
  };
  memory: {
    size: number;
    description: string;
  };
  languages: Record<
    string,
    {
      name: string;
      version: string;
    }[]
  >;
  extraInfo: string;
}

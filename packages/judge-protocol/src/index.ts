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

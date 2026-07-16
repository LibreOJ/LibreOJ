export const CaptchaAction = {
  Login: "login",
  SendEmailVerificationCode: "email_verification",
  Register: "register",
  ResetPassword: "reset_password",
  CreateDiscussion: "create_discussion",
  CreateDiscussionReply: "reply_discussion",
  CreateProblem: "create_problem",
  AddProblemFile: "add_problem_file",
  SubmitProblem: "submit_problem"
} as const;

export type CaptchaAction = typeof CaptchaAction[keyof typeof CaptchaAction];

export type CaptchaResult =
  | {
      turnstile: {
        token: string;
      };
    }
  | {
      tencentCaptcha: {
        ticket: string;
        randStr: string;
      };
    };

export type CaptchaAcquisition =
  | {
      status: "success";
      result?: CaptchaResult;
      consume(): void;
    }
  | {
      status: "cancelled";
      consume(): void;
    };

export interface CaptchaController<Action extends CaptchaAction = CaptchaAction> {
  readonly action: Action;
  acquireToken(): Promise<CaptchaAcquisition>;
}

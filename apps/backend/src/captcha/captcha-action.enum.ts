export const CAPTCHA_ACTION_METADATA = "captcha-action";

export enum CaptchaAction {
  Login = "login",
  SendEmailVerificationCode = "email_verification",
  Register = "register",
  ResetPassword = "reset_password",
  CreateDiscussion = "create_discussion",
  CreateDiscussionReply = "reply_discussion",
  CreateProblem = "create_problem",
  AddProblemFile = "add_problem_file",
  SubmitProblem = "submit_problem"
}

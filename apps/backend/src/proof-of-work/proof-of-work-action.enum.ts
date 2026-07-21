export const PROOF_OF_WORK_ACTION_METADATA = "proof-of-work-action";

export enum ProofOfWorkAction {
  Login = "login",
  SendEmailVerificationCode = "email_verification",
  Register = "register",
  ResetPassword = "reset_password",
  CreateDiscussion = "create_discussion",
  CreateDiscussionReply = "reply_discussion",
  CreateProblem = "create_problem",
  AddProblemFile = "add_problem_file",
  PrepareSubmissionFileUpload = "prepare_submission_file_upload",
  SubmitProblem = "submit_problem",
  AcquireTencentCaptcha = "acquire_tencent_captcha"
}

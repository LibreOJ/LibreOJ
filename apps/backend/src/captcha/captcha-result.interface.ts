export interface TurnstileCaptchaResult {
  turnstile: {
    token: string;
  };
}

export interface TencentCaptchaResult {
  tencentCaptcha: {
    ticket: string;
    randStr: string;
  };
}

export type CaptchaResult = TurnstileCaptchaResult | TencentCaptchaResult;

export const isCaptchaResult = (value: unknown): value is CaptchaResult => {
  const isRecord = (item: unknown): item is Record<string, unknown> =>
    typeof item === "object" && item !== null && !Array.isArray(item);
  const hasExactKeys = (item: Record<string, unknown>, keys: string[]): boolean => {
    const actualKeys = Object.keys(item);
    return actualKeys.length === keys.length && keys.every(key => actualKeys.includes(key));
  };

  if (!isRecord(value) || Object.keys(value).length !== 1) return false;

  if (isRecord(value.turnstile) && hasExactKeys(value.turnstile, ["token"])) {
    return (
      typeof value.turnstile.token === "string" &&
      value.turnstile.token.length > 0 &&
      value.turnstile.token.length <= 2048
    );
  }

  if (isRecord(value.tencentCaptcha) && hasExactKeys(value.tencentCaptcha, ["ticket", "randStr"])) {
    return (
      typeof value.tencentCaptcha.ticket === "string" &&
      value.tencentCaptcha.ticket.length > 0 &&
      typeof value.tencentCaptcha.randStr === "string" &&
      value.tencentCaptcha.randStr.length > 0
    );
  }

  return false;
};

import { Injectable, Logger } from "@nestjs/common";

import { ConfigService } from "../config/config.service";

interface TurnstileVerificationResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly configService: ConfigService) {}

  async verify(token: string, action: string, remoteIp: string): Promise<boolean> {
    const config = this.configService.config.security.captcha.turnstile;
    if (!config) throw new Error("Turnstile is not configured");

    const body = new URLSearchParams({
      secret: config.secretKey,
      response: token,
      remoteip: remoteIp
    });
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 10000);
    let response: Response;
    try {
      response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body,
        signal: abortController.signal
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`Turnstile verification request failed with HTTP ${response.status}`);

    const data = (await response.json()) as TurnstileVerificationResponse;

    if (typeof data?.success !== "boolean") {
      throw new Error("Turnstile returned an invalid verification response");
    }
    if (!data.success) {
      if (!Array.isArray(data["error-codes"]) || data["error-codes"].some(code => typeof code !== "string")) {
        throw new Error("Turnstile returned an invalid verification error response");
      }
      this.logger.warn(`Turnstile verification failed: ${data["error-codes"].join(", ")}`);
      return false;
    }
    if (data.action !== action) {
      this.logger.warn(`Turnstile action mismatch: expected ${action}, received ${data.action}`);
      return false;
    }

    this.logger.debug(
      `Turnstile verification succeeded: action=${data.action}, hostname=${data.hostname}, challenge=${data.challenge_ts}`
    );
    return true;
  }
}

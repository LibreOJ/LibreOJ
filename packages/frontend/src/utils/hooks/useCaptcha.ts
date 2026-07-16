import { useEffect, useMemo } from "react";
import type { TurnstileObject } from "turnstile-types";

import api from "@/api";
import { appState } from "@/appState";
import localeMeta from "@/locales/meta";
import { defaultDarkTheme } from "@/themes";

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

const TURNSTILE_INITIALIZATION_TIMEOUT = 5000;
const TURNSTILE_ACQUISITION_TIMEOUT = 1500;
const TURNSTILE_RETRY_TIMEOUT = 8000;
const TENCENT_CAPTCHA_INITIALIZATION_TIMEOUT = 5000;

const poll = async (condition: () => boolean, timeout: number): Promise<boolean> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeout) {
    if (condition()) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
};

let turnstilePromise: Promise<TurnstileObject | undefined>;

const loadTurnstile = (): Promise<TurnstileObject | undefined> => {
  if (!appState.serverPreference.security.turnstileSiteKey) return Promise.resolve(undefined);
  if (turnstilePromise) return turnstilePromise;

  turnstilePromise = (async () => {
    if (!document.getElementById("turnstile-script")) {
      const script = document.createElement("script");
      script.id = "turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    if (!(await poll(() => typeof window.turnstile !== "undefined", TURNSTILE_INITIALIZATION_TIMEOUT))) {
      console.warn("Timed out while initializing Turnstile");
      return undefined;
    }
    return window.turnstile;
  })();
  return turnstilePromise;
};

interface TencentCaptchaResponse {
  ret: number;
  ticket: string;
  randstr: string;
}

interface TencentCaptchaInstance {
  show(): void;
  destroy(): void;
}

type PendingCaptchaAcquisition = { status: "success"; result?: CaptchaResult } | { status: "cancelled" };

type TencentCaptchaConstructor = new (
  appId: string,
  callback: (response: TencentCaptchaResponse) => void,
  options: {
    userLanguage: string;
    enableDarkMode: boolean | "force";
    aidEncrypted: string;
    aidEncryptedType: "cbc";
    loading: boolean;
    type: "popup";
  }
) => TencentCaptchaInstance;

let tencentCaptchaPromise: Promise<TencentCaptchaConstructor | undefined>;

const loadTencentCaptcha = (): Promise<TencentCaptchaConstructor | undefined> => {
  if (tencentCaptchaPromise) return tencentCaptchaPromise;

  tencentCaptchaPromise = (async () => {
    if (!document.getElementById("tencent-captcha-script")) {
      const script = document.createElement("script");
      script.id = "tencent-captcha-script";
      script.src = "https://turing.captcha.qcloud.com/TJCaptcha.js";
      script.async = true;
      document.head.appendChild(script);
    }

    const tencentWindow = window as typeof window & { TencentCaptcha?: TencentCaptchaConstructor };
    if (
      !(await poll(() => typeof tencentWindow.TencentCaptcha !== "undefined", TENCENT_CAPTCHA_INITIALIZATION_TIMEOUT))
    ) {
      console.warn("Timed out while initializing Tencent Captcha");
      return undefined;
    }
    return tencentWindow.TencentCaptcha;
  })();
  return tencentCaptchaPromise;
};

const acquireTencentCaptchaToken = async (): Promise<PendingCaptchaAcquisition> => {
  const [TencentCaptcha, { requestError, response }] = await Promise.all([
    loadTencentCaptcha(),
    api.captcha.getTencentCaptchaAppId()
  ]);
  if (requestError) throw new Error("Failed to acquire Tencent Captcha application ID");
  if (!response) throw new Error("Tencent Captcha application ID endpoint returned no response");
  if (!response.appId || !response.encryptedAppId) throw new Error("Tencent Captcha is not configured");
  if (!TencentCaptcha) throw new Error("Failed to initialize Tencent Captcha");

  return await new Promise((resolve, reject) => {
    let captcha: TencentCaptchaInstance;
    captcha = new TencentCaptcha(
      response.appId,
      result => {
        captcha.destroy();
        if (result.ret === 2) {
          resolve({ status: "cancelled" });
        } else if (result.ret === 0) {
          resolve({
            status: "success",
            result: {
              tencentCaptcha: {
                ticket: result.ticket,
                randStr: result.randstr
              }
            }
          });
        } else {
          reject(new Error(`Tencent Captcha failed with code ${result.ret}`));
        }
      },
      {
        userLanguage: localeMeta[appState.locale].tencentCaptchaLanguageCode,
        enableDarkMode: appState.theme === defaultDarkTheme ? "force" : false,
        aidEncrypted: response.encryptedAppId,
        aidEncryptedType: "cbc",
        loading: true,
        type: "popup"
      }
    );
    captcha.show();
  });
};

type TurnstileState =
  | { status: "initializing" }
  | { status: "acquiring" }
  | { status: "ready"; token: string }
  | { status: "retryableError" }
  | { status: "unavailable" };

export const useCaptcha = <Action extends CaptchaAction>(action: Action): CaptchaController<Action> => {
  const captcha = useMemo(() => {
    let turnstileState: TurnstileState = { status: "initializing" };
    let turnstile: TurnstileObject | undefined;
    let turnstileWidgetId: string | undefined;
    let container: HTMLDivElement;
    let mountEpoch = 0;
    let acquisitionQueue = Promise.resolve();

    const resetTurnstile = () => {
      if (!turnstile || !turnstileWidgetId) return;
      turnstileState = { status: "acquiring" };
      turnstile.reset(turnstileWidgetId);
    };

    const waitForTurnstileToken = async (timeout: number): Promise<string | undefined> => {
      const deadline = Date.now() + timeout;
      while (true) {
        if (turnstileState.status === "ready") return turnstileState.token;
        if (turnstileState.status === "retryableError" || turnstileState.status === "unavailable") return undefined;
        if (Date.now() >= deadline) return undefined;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    };

    const acquireTurnstileToken = async (): Promise<string | undefined> => {
      let token = await waitForTurnstileToken(TURNSTILE_ACQUISITION_TIMEOUT);
      if (token || turnstileState.status !== "retryableError") return token;

      resetTurnstile();
      token = await waitForTurnstileToken(TURNSTILE_RETRY_TIMEOUT);
      return token;
    };

    const mount = () => {
      turnstileState = { status: "initializing" };
      const currentMountEpoch = ++mountEpoch;
      container = document.createElement("div");
      container.hidden = true;
      document.body.appendChild(container);

      void loadTurnstile().then(loadedTurnstile => {
        if (currentMountEpoch !== mountEpoch) return;
        if (!loadedTurnstile) {
          turnstileState = { status: "unavailable" };
          return;
        }

        turnstile = loadedTurnstile;
        try {
          turnstileState = { status: "acquiring" };
          turnstileWidgetId = turnstile.render(container, {
            sitekey: appState.serverPreference.security.turnstileSiteKey,
            action,
            size: "invisible",
            execution: "render",
            retry: "never",
            "response-field": false,
            callback: token => {
              turnstileState = { status: "ready", token };
            },
            "error-callback": errorCode => {
              console.warn(`Turnstile failed with code ${errorCode}`);
              const retryable =
                errorCode.startsWith("300") ||
                errorCode.startsWith("600") ||
                ["110600", "110620", "200500"].includes(errorCode);
              turnstileState = {
                status: retryable ? "retryableError" : "unavailable"
              };
            },
            "timeout-callback": () => {
              turnstileState = { status: "retryableError" };
            },
            "unsupported-callback": () => {
              turnstileState = { status: "unavailable" };
            },
            "expired-callback": resetTurnstile
          });
        } catch (error) {
          console.warn("Failed to render Turnstile", error);
          turnstileState = { status: "unavailable" };
        }
      });
    };

    const unmount = () => {
      mountEpoch += 1;
      if (turnstile && turnstileWidgetId) turnstile.remove(turnstileWidgetId);
      container.remove();
      turnstile = undefined;
      turnstileWidgetId = undefined;
    };

    const acquireToken = async (): Promise<CaptchaAcquisition> => {
      const previousAcquisition = acquisitionQueue;
      let releaseAcquisition: () => void;
      acquisitionQueue = new Promise(resolve => {
        releaseAcquisition = resolve;
      });
      await previousAcquisition;

      try {
        let acquisition: PendingCaptchaAcquisition;
        if (!appState.serverPreference.security.captchaEnabled || appState.currentUserHasPrivilege("SkipRecaptcha")) {
          acquisition = { status: "success" };
        } else {
          const turnstileToken = await acquireTurnstileToken();
          acquisition = turnstileToken
            ? { status: "success", result: { turnstile: { token: turnstileToken } } }
            : await acquireTencentCaptchaToken();
        }

        return {
          ...acquisition,
          consume: () => {
            if (acquisition.status === "success" && acquisition.result && "turnstile" in acquisition.result) {
              resetTurnstile();
            }
            releaseAcquisition();
          }
        } as CaptchaAcquisition;
      } catch (error) {
        releaseAcquisition();
        throw error;
      }
    };

    return {
      controller: { action, acquireToken },
      mount,
      unmount
    };
  }, [action]);

  useEffect(() => {
    captcha.mount();
    return captcha.unmount;
  }, [captcha]);
  return captcha.controller;
};

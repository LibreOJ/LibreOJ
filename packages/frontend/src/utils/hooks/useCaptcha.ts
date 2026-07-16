import { useEffect, useMemo } from "react";
import type { TurnstileObject } from "turnstile-types";

import api from "@/api";
import { CaptchaAction } from "@/captcha";
import type { CaptchaAcquisition, CaptchaController, CaptchaResult } from "@/captcha";
import { appState } from "@/appState";
import localeMeta from "@/locales/meta";
import { defaultDarkTheme } from "@/themes";

export { CaptchaAction } from "@/captcha";

const TURNSTILE_INITIALIZATION_TIMEOUT = 5000;
const TURNSTILE_ACQUISITION_TIMEOUT = 1500;
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
  | { status: "unavailable" };

class BrowserCaptchaController<Action extends CaptchaAction> implements CaptchaController<Action> {
  private turnstileState: TurnstileState = { status: "initializing" };

  private turnstile?: TurnstileObject;

  private turnstileWidgetId?: string;

  private container: HTMLDivElement;

  private mountEpoch = 0;

  private acquisitionQueue = Promise.resolve();

  constructor(readonly action: Action, private readonly enabled: boolean) {}

  mount(): void {
    this.turnstileState = { status: "initializing" };
    const mountEpoch = ++this.mountEpoch;
    this.container = document.createElement("div");
    this.container.hidden = true;
    document.body.appendChild(this.container);

    void loadTurnstile().then(turnstile => {
      if (mountEpoch !== this.mountEpoch) return;
      if (!turnstile) {
        this.turnstileState = { status: "unavailable" };
        return;
      }

      this.turnstile = turnstile;
      try {
        this.turnstileState = { status: "acquiring" };
        this.turnstileWidgetId = turnstile.render(this.container, {
          sitekey: appState.serverPreference.security.turnstileSiteKey,
          action: this.action,
          size: "invisible",
          execution: "render",
          "response-field": false,
          callback: token => {
            this.turnstileState = { status: "ready", token };
          },
          "error-callback": errorCode => {
            console.warn(`Turnstile failed with code ${errorCode}`);
            this.turnstileState = { status: "unavailable" };
          },
          "timeout-callback": () => {
            this.turnstileState = { status: "unavailable" };
          },
          "unsupported-callback": () => {
            this.turnstileState = { status: "unavailable" };
          },
          "expired-callback": () => this.resetTurnstile()
        });
      } catch (error) {
        console.warn("Failed to render Turnstile", error);
        this.turnstileState = { status: "unavailable" };
      }
    });
  }

  unmount(): void {
    this.mountEpoch += 1;
    if (this.turnstile && this.turnstileWidgetId) this.turnstile.remove(this.turnstileWidgetId);
    this.container.remove();
    this.turnstile = undefined;
    this.turnstileWidgetId = undefined;
  }

  async acquireToken(): Promise<CaptchaAcquisition> {
    if (!this.enabled) throw new Error(`Captcha action ${this.action} is not enabled`);

    const previousAcquisition = this.acquisitionQueue;
    let releaseAcquisition: () => void;
    this.acquisitionQueue = new Promise(resolve => {
      releaseAcquisition = resolve;
    });
    await previousAcquisition;

    try {
      let acquisition: PendingCaptchaAcquisition;
      if (!appState.serverPreference.security.captchaEnabled || appState.currentUserHasPrivilege("SkipRecaptcha")) {
        acquisition = { status: "success" };
      } else {
        const startedAt = Date.now();
        while (Date.now() - startedAt <= TURNSTILE_ACQUISITION_TIMEOUT) {
          if (this.turnstileState.status === "ready") {
            acquisition = {
              status: "success",
              result: { turnstile: { token: this.turnstileState.token } }
            };
            break;
          }
          if (this.turnstileState.status === "unavailable") break;
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        acquisition ??= await acquireTencentCaptchaToken();
      }

      return {
        ...acquisition,
        consume: () => {
          if (acquisition.status === "success" && acquisition.result && "turnstile" in acquisition.result) {
            this.resetTurnstile();
          }
          releaseAcquisition();
        }
      } as CaptchaAcquisition;
    } catch (error) {
      releaseAcquisition();
      throw error;
    }
  }

  private resetTurnstile(): void {
    if (!this.turnstile || !this.turnstileWidgetId) return;
    this.turnstile.reset(this.turnstileWidgetId);
    this.turnstileState = { status: "acquiring" };
  }
}

export const useCaptcha = <Action extends CaptchaAction>(action: Action, enabled = true): CaptchaController<Action> => {
  const controller = useMemo(() => new BrowserCaptchaController(action, enabled), [action, enabled]);
  useEffect(() => {
    if (!enabled) return;
    controller.mount();
    return () => controller.unmount();
  }, [controller, enabled]);
  return controller;
};

import axios from "axios";

import { appState } from "./appState";
import { makeToBeLocalizedText, ToBeLocalizedText } from "./locales";
import type { CaptchaAction, CaptchaController, CaptchaResult } from "./utils/hooks/useCaptcha";

export interface ApiResponse<T> {
  requestCancelled?: boolean;
  requestError?: ToBeLocalizedText;
  response?: T;
}

async function request<T>(
  path: string,
  method: "get" | "post",
  params?: any,
  body?: any,
  captchaResult?: CaptchaResult
): Promise<ApiResponse<T>> {
  let response: any;
  try {
    response = await axios(window.apiEndpoint + "api/" + path, {
      method: method,
      params: params,
      data: body && JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: appState.token && `Bearer ${appState.token}`,
        ...(captchaResult ? { "X-Captcha-Result": JSON.stringify(captchaResult) } : {})
      },
      validateStatus: () => true
    });
  } catch (e) {
    console.error(e);
    return {
      requestError: makeToBeLocalizedText("common.request_error.unknown", { text: e.message })
    };
  }

  if (![200, 201].includes(response.status)) {
    try {
      console.log("response.data:", response.data);
    } catch (e) {
      console.log("response:", response);
    }

    if ([400, 401, 403, 429, 500, 502, 503, 504].includes(response.status))
      return {
        requestError: makeToBeLocalizedText(`common.request_error.${response.status}`)
      };

    return {
      requestError: makeToBeLocalizedText("common.request_error.unknown", {
        text: `${response.status} ${response.statusText}`
      })
    };
  }

  return {
    response: typeof response.data === "string" ? JSON.parse(response.data) : response.data
  };
}

import * as api from "./api-generated";
export default api;

export function createPostApi<BodyType, ResponseType, Action extends CaptchaAction>(
  path: string,
  captchaAction: Action
): (requestBody: BodyType, captcha: CaptchaController<Action>) => Promise<ApiResponse<ResponseType>>;
export function createPostApi<BodyType, ResponseType>(
  path: string,
  captchaAction: null
): (requestBody: BodyType) => Promise<ApiResponse<ResponseType>>;

export function createPostApi<BodyType, ResponseType>(path: string, captchaAction: CaptchaAction | null) {
  return async (
    requestBody: BodyType,
    captcha?: CaptchaController<CaptchaAction>
  ): Promise<ApiResponse<ResponseType>> => {
    if (!captchaAction) return await request<ResponseType>(path, "post", null, requestBody);
    if (!captcha || captcha.action !== captchaAction) {
      throw new Error(`API ${path} requires captcha action ${captchaAction}`);
    }

    let acquisition;
    try {
      acquisition = await captcha.acquireToken();
    } catch (error) {
      console.error("Captcha acquisition failed", error);
      return {
        requestError: makeToBeLocalizedText("common.request_error.403")
      };
    }

    try {
      if (acquisition.status === "cancelled") return { requestCancelled: true };
      return await request<ResponseType>(path, "post", null, requestBody, acquisition.result);
    } finally {
      acquisition.consume();
    }
  };
}

export function createGetApi<QueryType, ResponseType>(path: string) {
  return async (requestQuery: QueryType): Promise<ApiResponse<ResponseType>> => {
    return await request<ResponseType>(path, "get", requestQuery, null);
  };
}

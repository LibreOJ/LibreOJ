import axios from "axios";

import { appState } from "./appState";
import { makeToBeLocalizedText, ToBeLocalizedText } from "./locales";
import type { CaptchaAction, CaptchaController, CaptchaResult } from "./utils/hooks/useCaptcha";
import { ProofOfWorkAction, ProofOfWorkResult, solveProofOfWork } from "./utils/proofOfWork";

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
  captchaResult?: CaptchaResult,
  proofOfWorkResult?: ProofOfWorkResult
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
        ...(captchaResult ? { "X-Captcha-Result": JSON.stringify(captchaResult) } : {}),
        ...(proofOfWorkResult ? { "X-Proof-Of-Work": JSON.stringify(proofOfWorkResult) } : {})
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

interface PostApiOptions {
  captchaAction?: CaptchaAction;
  proofOfWorkAction?: ProofOfWorkAction;
}

type CaptchaActionFromOptions<Options extends PostApiOptions> = Options extends { captchaAction: infer Action }
  ? Extract<Action, CaptchaAction>
  : never;

type PostApiResponse<ResponseType, Options extends PostApiOptions> = Options extends {
  captchaAction: CaptchaAction;
}
  ? ApiResponse<ResponseType>
  : Omit<ApiResponse<ResponseType>, "requestCancelled">;

type PostApi<BodyType, ResponseType, Options extends PostApiOptions> = Options extends {
  captchaAction: CaptchaAction;
}
  ? (
      requestBody: BodyType,
      captcha: CaptchaController<CaptchaActionFromOptions<Options>>
    ) => Promise<PostApiResponse<ResponseType, Options>>
  : (requestBody: BodyType) => Promise<PostApiResponse<ResponseType, Options>>;

class ProofOfWorkAcquisitionError extends Error {
  constructor(readonly requestError: ToBeLocalizedText) {
    super("Failed to acquire proof of work");
  }
}

let proofOfWorkAcquisitionQueue = Promise.resolve();

const acquireProofOfWork = async (action: ProofOfWorkAction): Promise<ProofOfWorkResult> => {
  const previousAcquisition = proofOfWorkAcquisitionQueue;
  let releaseAcquisition: () => void;
  proofOfWorkAcquisitionQueue = new Promise(resolve => {
    releaseAcquisition = resolve;
  });
  await previousAcquisition;

  try {
    const { requestError, response } = await request<ApiTypes.IssueProofOfWorkChallengeResponseDto>(
      "proofOfWork/issueChallenge",
      "post",
      null,
      { action }
    );
    if (requestError) throw new ProofOfWorkAcquisitionError(requestError);
    if (!response) throw new Error("Proof-of-work challenge endpoint returned no response");
    return await solveProofOfWork(response);
  } finally {
    releaseAcquisition();
  }
};

export function createPostApi<BodyType, ResponseType, Options extends PostApiOptions = {}>(
  path: string,
  options: Options
): PostApi<BodyType, ResponseType, Options>;

export function createPostApi<BodyType, ResponseType>(path: string, options: PostApiOptions) {
  return async (
    requestBody: BodyType,
    captcha?: CaptchaController<CaptchaAction>
  ): Promise<ApiResponse<ResponseType>> => {
    if (options.captchaAction && (!captcha || captcha.action !== options.captchaAction)) {
      throw new Error(`API ${path} requires captcha action ${options.captchaAction}`);
    }

    let acquisition;
    if (options.captchaAction) {
      try {
        acquisition = await captcha.acquireToken();
      } catch (error) {
        console.error("Captcha acquisition failed", error);
        return {
          requestError: makeToBeLocalizedText("common.request_error.403")
        };
      }
    }

    try {
      if (acquisition && acquisition.status === "cancelled") return { requestCancelled: true };

      let proofOfWorkResult: ProofOfWorkResult;
      try {
        if (options.proofOfWorkAction) proofOfWorkResult = await acquireProofOfWork(options.proofOfWorkAction);
      } catch (error) {
        console.error("Proof-of-work acquisition failed", error);
        if (error instanceof ProofOfWorkAcquisitionError) return { requestError: error.requestError };
        throw error;
      }

      return await request<ResponseType>(
        path,
        "post",
        null,
        requestBody,
        acquisition && acquisition.status === "success" ? acquisition.result : undefined,
        proofOfWorkResult
      );
    } finally {
      if (acquisition) acquisition.consume();
    }
  };
}

export function createGetApi<QueryType, ResponseType>(path: string) {
  return async (requestQuery: QueryType): Promise<ApiResponse<ResponseType>> => {
    return await request<ResponseType>(path, "get", requestQuery, null);
  };
}

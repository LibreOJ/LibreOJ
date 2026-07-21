// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const getTencentCaptchaAppId = createPostApi<
  void,
  ApiTypes.GetTencentCaptchaAppIdResponseDto,
  { proofOfWorkAction: "acquire_tencent_captcha" }
>("captcha/getTencentCaptchaAppId", { proofOfWorkAction: "acquire_tencent_captcha" });

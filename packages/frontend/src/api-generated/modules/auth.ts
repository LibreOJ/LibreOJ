// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const getSessionInfo = createGetApi<{ token?: string; jsonp?: string }, ApiTypes.GetSessionInfoResponseDto>(
  "auth/getSessionInfo"
);
export const login = createPostApi<ApiTypes.LoginRequestDto, ApiTypes.LoginResponseDto, { proofOfWorkAction: "login" }>(
  "auth/login",
  { proofOfWorkAction: "login" }
);
export const logout = createPostApi<void, void>("auth/logout", {});
export const checkAvailability = createGetApi<
  { username?: string; email?: string },
  ApiTypes.CheckAvailabilityResponseDto
>("auth/checkAvailability");
export const sendEmailVerificationCode = createPostApi<
  ApiTypes.SendEmailVerificationCodeRequestDto,
  ApiTypes.SendEmailVerificationCodeResponseDto,
  { proofOfWorkAction: "email_verification" }
>("auth/sendEmailVerificationCode", { proofOfWorkAction: "email_verification" });
export const register = createPostApi<
  ApiTypes.RegisterRequestDto,
  ApiTypes.RegisterResponseDto,
  { proofOfWorkAction: "register" }
>("auth/register", { proofOfWorkAction: "register" });
export const resetPassword = createPostApi<
  ApiTypes.ResetPasswordRequestDto,
  ApiTypes.ResetPasswordResponseDto,
  { proofOfWorkAction: "reset_password" }
>("auth/resetPassword", { proofOfWorkAction: "reset_password" });
export const listUserSessions = createPostApi<
  ApiTypes.ListUserSessionsRequestDto,
  ApiTypes.ListUserSessionsResponseDto
>("auth/listUserSessions", {});
export const revokeUserSession = createPostApi<
  ApiTypes.RevokeUserSessionRequestDto,
  ApiTypes.RevokeUserSessionResponseDto
>("auth/revokeUserSession", {});

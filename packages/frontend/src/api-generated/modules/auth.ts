// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const getSessionInfo = createGetApi<{ token?: string; jsonp?: string }, ApiTypes.GetSessionInfoResponseDto>(
  "auth/getSessionInfo"
);
export const login = createPostApi<ApiTypes.LoginRequestDto, ApiTypes.LoginResponseDto, "login">("auth/login", "login");
export const logout = createPostApi<void, void>("auth/logout", null);
export const checkAvailability = createGetApi<
  { username?: string; email?: string },
  ApiTypes.CheckAvailabilityResponseDto
>("auth/checkAvailability");
export const sendEmailVerificationCode = createPostApi<
  ApiTypes.SendEmailVerificationCodeRequestDto,
  ApiTypes.SendEmailVerificationCodeResponseDto,
  "email_verification"
>("auth/sendEmailVerificationCode", "email_verification");
export const register = createPostApi<ApiTypes.RegisterRequestDto, ApiTypes.RegisterResponseDto, "register">(
  "auth/register",
  "register"
);
export const resetPassword = createPostApi<
  ApiTypes.ResetPasswordRequestDto,
  ApiTypes.ResetPasswordResponseDto,
  "reset_password"
>("auth/resetPassword", "reset_password");
export const listUserSessions = createPostApi<
  ApiTypes.ListUserSessionsRequestDto,
  ApiTypes.ListUserSessionsResponseDto
>("auth/listUserSessions", null);
export const revokeUserSession = createPostApi<
  ApiTypes.RevokeUserSessionRequestDto,
  ApiTypes.RevokeUserSessionResponseDto
>("auth/revokeUserSession", null);

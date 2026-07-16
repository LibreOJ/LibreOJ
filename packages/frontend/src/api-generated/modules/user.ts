// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const searchUser = createGetApi<{ query: string; wildcard?: string }, ApiTypes.SearchUserResponseDto>(
  "user/searchUser"
);
export const getUserMeta = createPostApi<ApiTypes.GetUserMetaRequestDto, ApiTypes.GetUserMetaResponseDto>(
  "user/getUserMeta",
  null
);
export const setUserPrivileges = createPostApi<
  ApiTypes.SetUserPrivilegesRequestDto,
  ApiTypes.SetUserPrivilegesResponseDto
>("user/setUserPrivileges", null);
export const updateUserProfile = createPostApi<
  ApiTypes.UpdateUserProfileRequestDto,
  ApiTypes.UpdateUserProfileResponseDto
>("user/updateUserProfile", null);
export const getUserList = createPostApi<ApiTypes.GetUserListRequestDto, ApiTypes.GetUserListResponseDto>(
  "user/getUserList",
  null
);
export const getUserDetail = createPostApi<ApiTypes.GetUserDetailRequestDto, ApiTypes.GetUserDetailResponseDto>(
  "user/getUserDetail",
  null
);
export const getUserProfile = createPostApi<ApiTypes.GetUserProfileRequestDto, ApiTypes.GetUserProfileResponseDto>(
  "user/getUserProfile",
  null
);
export const getUserPreference = createPostApi<
  ApiTypes.GetUserPreferenceRequestDto,
  ApiTypes.GetUserPreferenceResponseDto
>("user/getUserPreference", null);
export const updateUserPreference = createPostApi<
  ApiTypes.UpdateUserPreferenceRequestDto,
  ApiTypes.UpdateUserPreferenceResponseDto
>("user/updateUserPreference", null);
export const getUserSecuritySettings = createPostApi<
  ApiTypes.GetUserSecuritySettingsRequestDto,
  ApiTypes.GetUserSecuritySettingsResponseDto
>("user/getUserSecuritySettings", null);
export const queryAuditLogs = createPostApi<ApiTypes.QueryAuditLogsRequestDto, ApiTypes.QueryAuditLogsResponseDto>(
  "user/queryAuditLogs",
  null
);
export const updateUserPassword = createPostApi<
  ApiTypes.UpdateUserPasswordRequestDto,
  ApiTypes.UpdateUserPasswordResponseDto
>("user/updateUserPassword", null);
export const updateUserSelfEmail = createPostApi<
  ApiTypes.UpdateUserSelfEmailRequestDto,
  ApiTypes.UpdateUserSelfEmailResponseDto
>("user/updateUserSelfEmail", null);

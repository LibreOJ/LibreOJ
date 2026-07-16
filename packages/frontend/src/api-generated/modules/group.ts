// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const getGroupMeta = createGetApi<{ groupId: string }, ApiTypes.GetGroupMetaResponseDto>("group/getGroupMeta");
export const searchGroup = createGetApi<{ query: string; wildcard?: string }, ApiTypes.SearchGroupResponseDto>(
  "group/searchGroup"
);
export const createGroup = createPostApi<ApiTypes.CreateGroupRequestDto, ApiTypes.CreateGroupResponseDto>(
  "group/createGroup",
  null
);
export const deleteGroup = createPostApi<ApiTypes.DeleteGroupRequestDto, ApiTypes.DeleteGroupResponseDto>(
  "group/deleteGroup",
  null
);
export const renameGroup = createPostApi<ApiTypes.RenameGroupRequestDto, ApiTypes.RenameGroupResponseDto>(
  "group/renameGroup",
  null
);
export const addMember = createPostApi<ApiTypes.AddUserToGroupRequestDto, ApiTypes.AddUserToGroupResponseDto>(
  "group/addMember",
  null
);
export const removeMember = createPostApi<
  ApiTypes.RemoveUserFromGroupRequestDto,
  ApiTypes.RemoveUserFromGroupResponseDto
>("group/removeMember", null);
export const setGroupAdmin = createPostApi<ApiTypes.SetGroupAdminRequestDto, ApiTypes.SetGroupAdminResponseDto>(
  "group/setGroupAdmin",
  null
);
export const getGroupList = createGetApi<void, ApiTypes.GetGroupListResponseDto>("group/getGroupList");
export const getGroupMemberList = createPostApi<
  ApiTypes.GetGroupMemberListRequestDto,
  ApiTypes.GetGroupMemberListResponseDto
>("group/getGroupMemberList", null);

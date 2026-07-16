// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const createDiscussion = createPostApi<
  ApiTypes.CreateDiscussionRequestDto,
  ApiTypes.CreateDiscussionResponseDto,
  "create_discussion"
>("discussion/createDiscussion", "create_discussion");
export const createDiscussionReply = createPostApi<
  ApiTypes.CreateDiscussionReplyRequestDto,
  ApiTypes.CreateDiscussionReplyResponseDto,
  "reply_discussion"
>("discussion/createDiscussionReply", "reply_discussion");
export const toggleReaction = createPostApi<ApiTypes.ToggleReactionRequestDto, ApiTypes.ToggleReactionResponseDto>(
  "discussion/toggleReaction",
  null
);
export const queryDiscussions = createPostApi<
  ApiTypes.QueryDiscussionsRequestDto,
  ApiTypes.QueryDiscussionsResponseDto
>("discussion/queryDiscussion", null);
export const getDiscussionPermissions = createPostApi<
  ApiTypes.GetDiscussionPermissionsRequestDto,
  ApiTypes.GetDiscussionPermissionsResponseDto
>("discussion/getDiscussionPermissions", null);
export const getDiscussionAndReplies = createPostApi<
  ApiTypes.GetDiscussionAndRepliesRequestDto,
  ApiTypes.GetDiscussionAndRepliesResponseDto
>("discussion/getDiscussionAndReplies", null);
export const updateDiscussion = createPostApi<
  ApiTypes.UpdateDiscussionRequestDto,
  ApiTypes.UpdateDiscussionResponseDto
>("discussion/updateDiscussion", null);
export const updateDiscussionReply = createPostApi<
  ApiTypes.UpdateDiscussionReplyRequestDto,
  ApiTypes.UpdateDiscussionReplyResponseDto
>("discussion/updateDiscussionReply", null);
export const deleteDiscussion = createPostApi<
  ApiTypes.DeleteDiscussionRequestDto,
  ApiTypes.DeleteDiscussionResponseDto
>("discussion/deleteDiscussion", null);
export const deleteDiscussionReply = createPostApi<
  ApiTypes.DeleteDiscussionReplyRequestDto,
  ApiTypes.DeleteDiscussionReplyResponseDto
>("discussion/deleteDiscussionReply", null);
export const setDiscussionPublic = createPostApi<
  ApiTypes.SetDiscussionPublicRequestDto,
  ApiTypes.SetDiscussionPublicResponseDto
>("discussion/setDiscussionPublic", null);
export const setDiscussionReplyPublic = createPostApi<
  ApiTypes.SetDiscussionReplyPublicRequestDto,
  ApiTypes.SetDiscussionReplyPublicResponseDto
>("discussion/setDiscussionReplyPublic", null);
export const setDiscussionPermissions = createPostApi<
  ApiTypes.SetDiscussionPermissionsRequestDto,
  ApiTypes.SetDiscussionPermissionsResponseDto
>("discussion/setDiscussionPermissions", null);

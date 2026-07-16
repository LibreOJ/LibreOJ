// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createGetApi, createPostApi } from "@/api";

export const submit = createPostApi<ApiTypes.SubmitRequestDto, ApiTypes.SubmitResponseDto, "submit_problem">(
  "submission/submit",
  "submit_problem"
);
export const querySubmission = createPostApi<ApiTypes.QuerySubmissionRequestDto, ApiTypes.QuerySubmissionResponseDto>(
  "submission/querySubmission",
  null
);
export const getSubmissionDetail = createPostApi<
  ApiTypes.GetSubmissionDetailRequestDto,
  ApiTypes.GetSubmissionDetailResponseDto
>("submission/getSubmissionDetail", null);
export const downloadSubmissionFile = createPostApi<
  ApiTypes.DownloadSubmissionFileRequestDto,
  ApiTypes.DownloadSubmissionFileResponseDto
>("submission/downloadSubmissionFile", null);
export const querySubmissionStatistics = createPostApi<
  ApiTypes.QuerySubmissionStatisticsRequestDto,
  ApiTypes.QuerySubmissionStatisticsResponseDto
>("submission/querySubmissionStatistics", null);
export const rejudgeSubmission = createPostApi<
  ApiTypes.RejudgeSubmissionRequestDto,
  ApiTypes.RejudgeSubmissionResponseDto
>("submission/rejudgeSubmission", null);
export const cancelSubmission = createPostApi<
  ApiTypes.CancelSubmissionRequestDto,
  ApiTypes.CancelSubmissionResponseDto
>("submission/cancelSubmission", null);
export const setSubmissionPublic = createPostApi<
  ApiTypes.SetSubmissionPublicRequestDto,
  ApiTypes.SetSubmissionPublicResponseDto
>("submission/setSubmissionPublic", null);
export const deleteSubmission = createPostApi<
  ApiTypes.DeleteSubmissionRequestDto,
  ApiTypes.DeleteSubmissionResponseDto
>("submission/deleteSubmission", null);

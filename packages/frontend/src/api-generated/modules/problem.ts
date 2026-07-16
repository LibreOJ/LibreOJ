// This file is generated automatically, do NOT modify it.

/// <reference path="../types.d.ts" />

import { createPostApi } from "@/api";

export const queryProblemSet = createPostApi<ApiTypes.QueryProblemSetRequestDto, ApiTypes.QueryProblemSetResponseDto>(
  "problem/queryProblemSet",
  null
);
export const createProblem = createPostApi<
  ApiTypes.CreateProblemRequestDto,
  ApiTypes.CreateProblemResponseDto,
  "create_problem"
>("problem/createProblem", "create_problem");
export const updateStatement = createPostApi<
  ApiTypes.UpdateProblemStatementRequestDto,
  ApiTypes.UpdateProblemStatementResponseDto
>("problem/updateStatement", null);
export const getProblem = createPostApi<ApiTypes.GetProblemRequestDto, ApiTypes.GetProblemResponseDto>(
  "problem/getProblem",
  null
);
export const setProblemPermissions = createPostApi<
  ApiTypes.SetProblemPermissionsRequestDto,
  ApiTypes.SetProblemPermissionsResponseDto
>("problem/setProblemPermissions", null);
export const setProblemDisplayId = createPostApi<
  ApiTypes.SetProblemDisplayIdRequestDto,
  ApiTypes.SetProblemDisplayIdResponseDto
>("problem/setProblemDisplayId", null);
export const setProblemPublic = createPostApi<
  ApiTypes.SetProblemPublicRequestDto,
  ApiTypes.SetProblemPublicResponseDto
>("problem/setProblemPublic", null);
export const addProblemFile = createPostApi<
  ApiTypes.AddProblemFileRequestDto,
  ApiTypes.AddProblemFileResponseDto,
  "add_problem_file"
>("problem/addProblemFile", "add_problem_file");
export const removeProblemFiles = createPostApi<
  ApiTypes.RemoveProblemFilesRequestDto,
  ApiTypes.RemoveProblemFilesResponseDto
>("problem/removeProblemFiles", null);
export const downloadProblemFiles = createPostApi<
  ApiTypes.DownloadProblemFilesRequestDto,
  ApiTypes.DownloadProblemFilesResponseDto
>("problem/downloadProblemFiles", null);
export const renameProblemFile = createPostApi<
  ApiTypes.RenameProblemFileRequestDto,
  ApiTypes.RenameProblemFileResponseDto
>("problem/renameProblemFile", null);
export const updateProblemJudgeInfo = createPostApi<
  ApiTypes.UpdateProblemJudgeInfoRequestDto,
  ApiTypes.UpdateProblemJudgeInfoResponseDto
>("problem/updateProblemJudgeInfo", null);
export const getAllProblemTags = createPostApi<
  ApiTypes.GetAllProblemTagsRequestDto,
  ApiTypes.GetAllProblemTagsResponseDto
>("problem/getAllProblemTags", null);
export const createProblemTag = createPostApi<
  ApiTypes.CreateProblemTagRequestDto,
  ApiTypes.CreateProblemTagResponseDto
>("problem/createProblemTag", null);
export const getProblemTagDetail = createPostApi<
  ApiTypes.GetProblemTagDetailRequestDto,
  ApiTypes.GetProblemTagDetailResponseDto
>("problem/getProblemTagDetail", null);
export const updateProblemTag = createPostApi<
  ApiTypes.UpdateProblemTagRequestDto,
  ApiTypes.UpdateProblemTagResponseDto
>("problem/updateProblemTag", null);
export const deleteProblemTag = createPostApi<
  ApiTypes.DeleteProblemTagRequestDto,
  ApiTypes.DeleteProblemTagResponseDto
>("problem/deleteProblemTag", null);
export const getAllProblemTagsOfAllLocales = createPostApi<void, ApiTypes.GetAllProblemTagsOfAllLocalesResponseDto>(
  "problem/getAllProblemTagsOfAllLocales",
  null
);
export const deleteProblem = createPostApi<ApiTypes.DeleteProblemRequestDto, ApiTypes.DeleteProblemResponseDto>(
  "problem/deleteProblem",
  null
);
export const changeProblemType = createPostApi<
  ApiTypes.ChangeProblemTypeRequestDto,
  ApiTypes.ChangeProblemTypeResponseDto
>("problem/changeProblemType", null);

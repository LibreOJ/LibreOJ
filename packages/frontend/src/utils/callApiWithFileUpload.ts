import Axios from "axios";

import { ApiResponse } from "@/api";

export interface ApiResponseWithUploadResult<T extends { error?: string }> {
  uploadCancelled?: boolean;
  uploadError?: any;
  requestError?: ApiResponse<T>["requestError"];
  response?: Omit<T, "signedUploadRequest">;
}

export interface FileUploadApiProgress {
  status: "Requesting" | "Uploading" | "Retrying";
  progress: number;
}

interface CallApiWithFileUploadOptions<
  Request extends { uploadInfo?: ApiTypes.FileUploadInfoDto },
  Response extends { error?: string; signedUploadRequest?: ApiTypes.SignedFileUploadRequestDto }
> {
  api: (request: Request) => Promise<ApiResponse<Response>>;
  prepareUploadApi?: (request: Omit<Request, "uploadInfo">, file: Blob) => Promise<ApiResponse<Response>>;
  request: Omit<Request, "uploadInfo">;
  file: Blob;
  onProgress?: (progress: FileUploadApiProgress) => void;
  onCancelAvailable?: (cancel: () => void) => void;
}

// Workaround: xdomain's FormData doesn't set [Symbol.toStringTag] to "FormData"
//             so axios doesn't treat it as FormData
//             see https://github.com/axios/axios/blob/c9aca7525703ab600eacd9e95fd7f6ecc9942616/lib/utils.js#L56
if (FormData.prototype[Symbol.toStringTag] !== "FormData") FormData.prototype[Symbol.toStringTag] = "FormData";

export async function callApiWithFileUpload<
  Request extends { uploadInfo?: ApiTypes.FileUploadInfoDto },
  Response extends { error?: string; signedUploadRequest?: ApiTypes.SignedFileUploadRequestDto }
>(options: CallApiWithFileUploadOptions<Request, Response>): Promise<ApiResponseWithUploadResult<Response>> {
  if (options.onProgress) options.onProgress({ status: "Requesting", progress: 0 });

  const result =
    options.file && options.prepareUploadApi
      ? await options.prepareUploadApi(options.request, options.file)
      : await options.api({
          ...options.request,
          uploadInfo: options.file
            ? {
                size: options.file.size,
                uuid: null
              }
            : null
        } as Request);
  if (result.requestCancelled) return { uploadCancelled: true };
  if (result.requestError) return result;

  if (result.response.signedUploadRequest) {
    // Upload is required

    const cancelTokenSource = Axios.CancelToken.source();
    let isCancelled = false;
    const cancelFunction = () => {
      if (isCancelled) return;
      isCancelled = true;
      cancelTokenSource.cancel();
    };

    if (options.onCancelAvailable) options.onCancelAvailable(cancelFunction);

    let error = false;
    function onUploadProgress(e: ProgressEvent<EventTarget>) {
      // setTimeout is a workaround for Axios triggers a "progress" event with 100% loaded after error

      if (options.onProgress)
        setTimeout(() => {
          if (error) return;

          options.onProgress({ status: "Uploading", progress: e.loaded / e.total });
        }, 0);
    }

    const UPLOAD_RETRY_TIMES = 5;
    const UPLOAD_RETRY_DEALY_MAX = 5;
    for (let i = 0; i < UPLOAD_RETRY_TIMES; i++) {
      try {
        if (result.response.signedUploadRequest.method === "PUT") {
          await Axios.put(result.response.signedUploadRequest.url, options.file, {
            cancelToken: cancelTokenSource.token,
            onUploadProgress
          });
        } else {
          const formData = new FormData();
          Object.entries(result.response.signedUploadRequest.extraFormData).forEach(([key, value]) =>
            formData.append(key, value as string)
          );

          formData.append(result.response.signedUploadRequest.fileFieldName, options.file);
          await Axios.post(result.response.signedUploadRequest.url, formData, {
            cancelToken: cancelTokenSource.token,
            onUploadProgress
          });
        }

        // Success, break retry loop
        break;
      } catch (e) {
        if (isCancelled) {
          // Cancelled, don't retry
          error = true;
          return { uploadCancelled: true };
        } else if (i === UPLOAD_RETRY_TIMES - 1) {
          // Failed after all retries
          error = true;
          return { uploadError: e };
        } else {
          // Retry after a delay
          if (options.onProgress) options.onProgress({ status: "Retrying", progress: 0 });
          await new Promise(resolve => setTimeout(resolve, UPLOAD_RETRY_DEALY_MAX * 1000 * Math.random()));
        }
      }
    }

    if (options.onProgress) options.onProgress({ status: "Requesting", progress: 0 });

    const completionResult = await options.api({
      ...options.request,
      uploadInfo: {
        size: options.file.size,
        uuid: result.response.signedUploadRequest.uuid
      }
    } as Request);
    return completionResult.requestCancelled ? { uploadCancelled: true } : completionResult;
  }
  // Upload is not required
  else return result;
}

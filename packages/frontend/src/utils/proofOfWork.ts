export type ProofOfWorkAction = ApiTypes.IssueProofOfWorkChallengeRequestDto["action"];

export interface ProofOfWorkResult {
  id: string;
  nonce: number;
  response: string;
}

interface WorkerResult {
  nonce: number;
  response: string;
}

type ProofOfWorkWorkerConstructor = new () => Worker;

let workerConstructorPromise: Promise<ProofOfWorkWorkerConstructor> | undefined;

// Inline workers create page-origin blob URLs because production JavaScript is served from a separate CDN:
// https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker#security
const getWorkerConstructor = (): Promise<ProofOfWorkWorkerConstructor> => {
  if (!workerConstructorPromise) {
    workerConstructorPromise = (
      navigator.userAgent.includes("Firefox") || navigator.userAgent.includes("Goanna")
        ? import("./workers/proofOfWorkPureJs.worker?worker&inline")
        : import("./workers/proofOfWorkWebCrypto.worker?worker&inline")
    ).then(module => module.default);
  }
  return workerConstructorPromise;
};

export const solveProofOfWork = async (
  challenge: ApiTypes.IssueProofOfWorkChallengeResponseDto
): Promise<ProofOfWorkResult> => {
  const WorkerConstructor = await getWorkerConstructor();
  const threads = Math.trunc(Math.max((navigator.hardwareConcurrency || 1) / 2, 1));
  const workers: Worker[] = [];
  let abort: (error: Error) => void;
  const onPageHide = () => abort(new DOMException("Page closed while calculating proof of work", "AbortError"));
  const expirationTimeout = setTimeout(
    () => abort(new DOMException("Proof-of-work challenge expired", "TimeoutError")),
    Math.max(challenge.expiresAt - Date.now(), 0)
  );

  try {
    const result = await new Promise<WorkerResult>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        callback();
      };
      abort = error => finish(() => reject(error));

      window.addEventListener("pagehide", onPageHide, { once: true });

      for (let index = 0; index < threads; index += 1) {
        const worker = new WorkerConstructor();
        worker.onmessage = event => finish(() => resolve(event.data as WorkerResult));
        worker.onerror = event => finish(() => reject(event));
        worker.postMessage({
          randomData: challenge.randomData,
          difficulty: challenge.difficulty,
          nonce: index,
          threads
        });
        workers.push(worker);
      }
    });

    return { id: challenge.id, ...result };
  } finally {
    clearTimeout(expirationTimeout);
    window.removeEventListener("pagehide", onPageHide);
    workers.forEach(worker => worker.terminate());
  }
};

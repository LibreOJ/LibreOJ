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

const createWorker = (): Worker =>
  navigator.userAgent.includes("Firefox") || navigator.userAgent.includes("Goanna")
    ? new Worker(new URL("./workers/proofOfWorkPureJs.worker.ts", import.meta.url), { type: "module" })
    : new Worker(new URL("./workers/proofOfWorkWebCrypto.worker.ts", import.meta.url), { type: "module" });

export const solveProofOfWork = async (
  challenge: ApiTypes.IssueProofOfWorkChallengeResponseDto
): Promise<ProofOfWorkResult> => {
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
        const worker = createWorker();
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

import { Sha256 } from "@aws-crypto/sha256-js";

interface WorkerRequest {
  randomData: string;
  difficulty: number;
  nonce: number;
  threads: number;
}

const encoder = new TextEncoder();

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

const hasLeadingZeroes = (bytes: Uint8Array, difficulty: number): boolean => {
  const completeBytes = Math.floor(difficulty / 2);
  for (let index = 0; index < completeBytes; index += 1) {
    if (bytes[index] !== 0) return false;
  }
  return difficulty % 2 === 0 || bytes[completeBytes] >> 4 === 0;
};

const postResultIfValid = (nonce: number, digest: Uint8Array, difficulty: number): boolean => {
  if (!hasLeadingZeroes(digest, difficulty)) return false;
  postMessage({ nonce, response: toHex(digest) });
  return true;
};

const solveWithPureJs = (data: WorkerRequest): void => {
  for (let nonce = data.nonce; ; nonce += data.threads) {
    const hash = new Sha256();
    hash.update(data.randomData + nonce);
    if (postResultIfValid(nonce, hash.digestSync(), data.difficulty)) return;
  }
};

const solveWithWebCrypto = async (data: WorkerRequest): Promise<void> => {
  for (let nonce = data.nonce; ; nonce += data.threads) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(data.randomData + nonce));
    if (postResultIfValid(nonce, new Uint8Array(digest), data.difficulty)) return;
  }
};

addEventListener("message", ({ data }: MessageEvent<WorkerRequest>) => {
  const usePureJs = navigator.userAgent.includes("Firefox") || navigator.userAgent.includes("Goanna");
  if (usePureJs) solveWithPureJs(data);
  else void solveWithWebCrypto(data);
});

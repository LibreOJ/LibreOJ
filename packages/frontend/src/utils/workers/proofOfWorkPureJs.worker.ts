import { Sha256 } from "@aws-crypto/sha256-js";

interface WorkerRequest {
  randomData: string;
  difficulty: number;
  nonce: number;
  threads: number;
}

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

addEventListener("message", ({ data }: MessageEvent<WorkerRequest>) => {
  let nonce = data.nonce;

  while (true) {
    const hash = new Sha256();
    hash.update(data.randomData + nonce);
    const digest = hash.digestSync();
    if (hasLeadingZeroes(digest, data.difficulty)) {
      postMessage({ nonce, response: toHex(digest) });
      return;
    }
    nonce += data.threads;
  }
});

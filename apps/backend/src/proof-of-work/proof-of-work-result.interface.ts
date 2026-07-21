export interface ProofOfWorkResult {
  id: string;
  nonce: number;
  response: string;
}

export const isProofOfWorkResult = (value: unknown): value is ProofOfWorkResult => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const result = value as Record<string, unknown>;
  const keys = Object.keys(result);
  return (
    keys.length === 3 &&
    keys.includes("id") &&
    keys.includes("nonce") &&
    keys.includes("response") &&
    typeof result.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result.id) &&
    typeof result.nonce === "number" &&
    Number.isSafeInteger(result.nonce) &&
    result.nonce >= 0 &&
    typeof result.response === "string" &&
    /^[0-9a-f]{64}$/.test(result.response)
  );
};

export async function md5(str: string) {
  const result = await crypto.subtle.digest("sha-1", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(result))
    .map(x => x.toString(16).padStart(2, ""))
    .join("");
}

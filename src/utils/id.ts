/**
 * 生成匿名身份 ID：`usr_` + 16 位 base36。
 * 与后端约定一致 —— 由浏览器将用户资料、时间戳与随机 salt 混合生成。
 */
export async function generateUserId(profile: {
  nickname: string;
  gender: string;
  region: string;
}): Promise<string> {
  const salt = crypto.getRandomValues(new Uint32Array(4)).join("-");
  const raw = `${profile.nickname}|${profile.gender}|${profile.region}|${Date.now()}|${salt}`;

  let hex: string;
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } else {
    // 非安全上下文退化方案：FNV-1a
    let h = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    hex = h.toString(16).repeat(8).slice(0, 64);
  }

  let suffix = "";
  for (let i = 0; i < 16; i += 4) {
    const chunk = parseInt(hex.slice(i * 2, i * 2 + 8), 16);
    suffix += chunk.toString(36).padStart(5, "0").slice(-4);
  }
  return `usr_${suffix.slice(0, 16)}`;
}

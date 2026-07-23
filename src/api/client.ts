import type { ApiErrorShape, Bottle, Identity, Plane } from "./types";

const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError("连不上服务器，请确认后端已启动。", 0);
  }
  let body: (ApiErrorShape & { data?: unknown; message?: string }) | null = null;
  try {
    body = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }
  if (!res.ok) {
    throw new ApiError(body?.error?.message ?? `请求失败（${res.status}）`, res.status);
  }
  return body as T;
}

function postJson(payload: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

/** 图文发布：带图走 multipart，纯文字走 JSON */
function publishPayload(userId: string, content: string, image: File | null): RequestInit {
  if (!image) return postJson({ user_id: userId, content });
  const form = new FormData();
  form.append("user_id", userId);
  form.append("content", content);
  form.append("image", image);
  return { method: "POST", body: form };
}

export const api = {
  // ---------- 用户 ----------
  createUser(payload: {
    id: string;
    nickname: string;
    birthday: string;
    gender: string;
    region: string;
  }) {
    return request<{ data: Identity }>("/users", postJson(payload));
  },
  getUser(userId: string) {
    return request<{ data: Identity }>(`/users/${encodeURIComponent(userId)}`);
  },

  // ---------- 浮笺 ----------
  publishBottle(userId: string, content: string, image: File | null) {
    return request<{ data: Bottle }>("/bottles", publishPayload(userId, content, image));
  },
  discoverBottle(userId: string) {
    return request<{ data: Bottle | null; message?: string }>(
      `/bottles/discover?user_id=${encodeURIComponent(userId)}`,
    );
  },
  toggleBottleLike(bottleId: string, userId: string) {
    return request<{ data: { liked: boolean } }>(
      `/bottles/${encodeURIComponent(bottleId)}/likes`,
      postJson({ user_id: userId }),
    );
  },
  commentBottle(bottleId: string, userId: string, content: string) {
    return request<{ data: { sent: boolean } }>(
      `/bottles/${encodeURIComponent(bottleId)}/comments`,
      postJson({ user_id: userId, content }),
    );
  },
  myBottles(userId: string) {
    return request<{ data: Bottle[] }>(`/bottles/mine/${encodeURIComponent(userId)}`);
  },

  // ---------- 飞笺 ----------
  publishPlane(userId: string, content: string, image: File | null) {
    return request<{ data: Plane }>("/planes", publishPayload(userId, content, image));
  },
  discoverPlane(userId: string) {
    return request<{ data: Plane | null; message?: string }>(
      `/planes/discover?user_id=${encodeURIComponent(userId)}`,
    );
  },
  togglePlaneLike(planeId: string, userId: string) {
    return request<{ data: { liked: boolean } }>(
      `/planes/${encodeURIComponent(planeId)}/likes`,
      postJson({ user_id: userId }),
    );
  },
  commentPlane(planeId: string, userId: string, content: string) {
    return request<{ data: { sent: boolean } }>(
      `/planes/${encodeURIComponent(planeId)}/comments`,
      postJson({ user_id: userId, content }),
    );
  },
  myPlanes(userId: string) {
    return request<{ data: Plane[] }>(`/planes/mine/${encodeURIComponent(userId)}`);
  },
};

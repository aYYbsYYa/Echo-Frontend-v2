import type {
  ApiErrorShape,
  Bottle,
  Capsule,
  CapsuleDuration,
  CapsuleListMeta,
  CapsuleMood,
  EchoConversation,
  EchoMessage,
  EchoMode,
  EchoProfile,
  Identity,
  Plane,
  SoulDialogue,
  SoulMatchResult,
  SoulProfile,
  SoulStreamEvent,
} from "./types";

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
    // 兼容两种错误形态：{"error": {"message": ...}} 与 {"error": "..."}
    const shape = body?.error;
    const text =
      (typeof shape === "string" ? shape : shape?.message) ?? `请求失败（${res.status}）`;
    throw new ApiError(text, res.status);
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

function patchJson(payload: unknown): RequestInit {
  return {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

/**
 * 解包灵笺画像的存储层嵌套。
 * 后端 refresh 端点返回完整存储记录（profile_data 多包一层），
 * 这里逐层剥到带 status 的画像本体为止。
 */
function unwrapEchoProfile(raw: unknown): EchoProfile {
  let node: unknown = raw;
  while (
    node &&
    typeof node === "object" &&
    !("status" in node) &&
    "profile_data" in node
  ) {
    node = (node as Record<string, unknown>).profile_data;
  }
  return (node ?? { status: "insufficient_data", message_count: 0 }) as EchoProfile;
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

  // ---------- 时光胶囊（森林） ----------
  buryCapsule(
    userId: string,
    content: string,
    duration: CapsuleDuration,
    mood: CapsuleMood | null,
    customSeconds?: number,
    image?: string,
  ) {
    return request<{ data: Capsule }>(
      "/capsules",
      postJson({ user_id: userId, content, duration, mood, custom_seconds: customSeconds, image }),
    );
  },
  myCapsules(userId: string) {
    return request<{ data: Capsule[]; meta: CapsuleListMeta }>(
      `/capsules/mine/${encodeURIComponent(userId)}`,
    );
  },
  openCapsule(capsuleId: string, userId: string) {
    return request<{ data: Capsule }>(
      `/capsules/${encodeURIComponent(capsuleId)}/open`,
      postJson({ user_id: userId }),
    );
  },
  /** 配图 URL（浏览器直接 <img> 加载；服务端做解锁校验） */
  capsuleImageUrl(capsuleId: string, userId: string) {
    return `${BASE}/capsules/${encodeURIComponent(capsuleId)}/image?user_id=${encodeURIComponent(userId)}`;
  },

  // ---------- 灵笺（自我对话） ----------
  createEchoConversation(userId: string, mode: EchoMode = "listen") {
    return request<{ data: EchoConversation }>(
      "/echo/conversations",
      postJson({ user_id: userId, mode }),
    );
  },
  getEchoConversation(conversationId: string) {
    return request<{ data: EchoConversation }>(
      `/echo/conversations/${encodeURIComponent(conversationId)}`,
    );
  },
  listEchoConversations(userId: string) {
    return request<{ data: EchoConversation[] }>(
      `/echo/users/${encodeURIComponent(userId)}/conversations`,
    );
  },
  sendEchoMessage(conversationId: string, content: string) {
    return request<{
      data: { user_message: EchoMessage; assistant_message: EchoMessage };
    }>(`/echo/conversations/${encodeURIComponent(conversationId)}/messages`, postJson({ content }));
  },
  switchEchoMode(conversationId: string, mode: EchoMode) {
    return request<{ data: EchoConversation }>(
      `/echo/conversations/${encodeURIComponent(conversationId)}/mode`,
      patchJson({ mode }),
    );
  },
  getEchoProfile(userId: string) {
    return request<{ data: unknown }>(
      `/echo/users/${encodeURIComponent(userId)}/profile`,
    ).then((res) => ({ data: unwrapEchoProfile(res.data) }));
  },
  refreshEchoProfile(userId: string) {
    return request<{ data: unknown }>(
      `/echo/users/${encodeURIComponent(userId)}/profile/refresh`,
      postJson({}),
    ).then((res) => ({ data: unwrapEchoProfile(res.data) }));
  },

  // ---------- Agent-to-Agent（灵魂碰撞） ----------
  getSoulProfile(userId: string, refresh = false) {
    const query = refresh ? "&refresh=true" : "";
    return request<{ data: SoulProfile }>(
      `/agent/profile?user_id=${encodeURIComponent(userId)}${query}`,
    );
  },
  matchSouls(userId: string, limit = 3) {
    return request<{ data: SoulMatchResult }>("/agent/match", postJson({ user_id: userId, limit }));
  },
  runSoulDialogue(userId: string, targetUserId?: string) {
    return request<{ data: SoulDialogue }>(
      "/agent/dialogue",
      postJson(targetUserId ? { user_id: userId, target_user_id: targetUserId } : { user_id: userId }),
    );
  },
  listSoulDialogues(userId: string) {
    return request<{ data: SoulDialogue[] }>(
      `/agent/dialogues?user_id=${encodeURIComponent(userId)}`,
    );
  },
  deleteSoulDialogue(userId: string, dialogueId: string) {
    return request<{ data: { id: string; deleted: boolean } }>(
      `/agent/dialogues/${encodeURIComponent(dialogueId)}?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
  },
};

/**
 * 逐行读取灵魂碰撞的 NDJSON 流。
 * 事件按到达顺序交给回调；连接中断或解析失败会抛 ApiError。
 */
export async function streamSoulDialogue(
  userId: string,
  targetUserId: string | undefined,
  onEvent: (event: SoulStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/agent/dialogue/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        targetUserId ? { user_id: userId, target_user_id: targetUserId } : { user_id: userId },
      ),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw new ApiError("连不上服务器，请确认后端已启动。", 0);
  }
  if (!res.ok) {
    let message = `请求失败（${res.status}）`;
    try {
      const body = (await res.json()) as ApiErrorShape;
      const shape = body?.error;
      if (typeof shape === "string") message = shape;
      else if (shape?.message) message = shape.message;
    } catch {
      /* 忽略解析失败 */
    }
    throw new ApiError(message, res.status);
  }
  if (!res.body) throw new ApiError("当前浏览器不支持流式读取。", 0);

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as SoulStreamEvent);
        } catch {
          /* 跳过无法解析的行 */
        }
      }
      newline = buffer.indexOf("\n");
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      onEvent(JSON.parse(tail) as SoulStreamEvent);
    } catch {
      /* 忽略半截事件 */
    }
  }
}

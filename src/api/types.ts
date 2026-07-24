/** 与 Echo-Backtend 对齐的数据结构 */

export type Gender = "male" | "female" | "prefer_not_to_say" | string;

export interface Identity {
  id: string;
  nickname: string;
  avatar: string;
  region: string;
  birthday?: string;
  gender?: Gender;
}

export interface ItemComment {
  id: string;
  item_id: string;
  user_id: string;
  nickname: string;
  content: string;
  created_at: string;
}

export interface Bottle {
  id: string;
  type: "bottle";
  scene: BottleScene;
  content: string;
  image_url: string | null;
  nickname: string;
  avatar: string;
  region: string;
  created_at: string;
  views: number;
  reply: string | null;
  is_author: boolean;
  liked: boolean;
  /** 仅作者可见 */
  likes?: number;
  /** 仅作者可见 */
  comments?: ItemComment[];
}

export type BottleScene = "shallow" | "deep" | "drift";

export type PlaneScene = "sky" | "window" | "tree";

export interface Plane {
  id: string;
  type: "plane";
  scene: PlaneScene;
  content: string;
  image_url: string | null;
  nickname: string;
  avatar: string;
  region: string;
  created_at: string;
  views: number;
  reply: string | null;
  is_author: boolean;
  liked: boolean;
  likes?: number;
  comments?: ItemComment[];
}

export type DriftItem = Bottle | Plane;

/** 时光胶囊（森林 · 树洞） */
export type CapsuleDuration = "minute" | "month1" | "month3" | "month6" | "month12" | "custom";

export type CapsuleMood = "expect" | "lost" | "miss" | "grateful" | "resolve" | "calm";

export interface Capsule {
  id: string;
  type: "capsule";
  mood: CapsuleMood | null;
  duration: CapsuleDuration;
  duration_label: string;
  created_at: string;
  unlock_at: string;
  opened_at: string | null;
  is_unlocked: boolean;
  remaining_seconds: number;
  /** 已等待时长的中文描述 */
  waited_label: string;
  /** 是否随信封存了照片 */
  has_image: boolean;
  /** 仅解锁且调用开启接口后下发 */
  content: string | null;
}

export interface CapsuleListMeta {
  total: number;
  /** 已到期但尚未开启的数量 */
  unlockable: number;
}

export interface ApiErrorShape {
  error?: { message?: string; remaining_seconds?: number } | string;
}

/* ============================================================
   灵笺（Echo）—— AI 自我对话与洞察
   ============================================================ */

export type EchoMode = "listen" | "mirror";

export interface EchoMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** 消息产生时所处的模式（后端按模式隔离上下文） */
  mode?: EchoMode;
}

export interface EchoConversation {
  id: string;
  user_id: string;
  mode: EchoMode;
  created_at: string;
  updated_at: string;
  messages?: EchoMessage[];
}

/** 人格画像的结构化内核 */
export interface EchoPersona {
  identity: string;
  traits: string[];
  emotion_pattern: string[];
  interests: string[];
  values: string[];
}

/**
 * 人格画像：对话充足与不足是两种形态。
 * 注意：后端 refresh 端点返回的是完整存储记录（多包一层 profile_data），
 * client 层会统一解包成本结构。
 */
export interface EchoProfile {
  status: "available" | "insufficient_data" | string;
  message_count: number;
  /** insufficient_data 时的说明文案 */
  summary?: string;
  profile_data?: {
    persona: EchoPersona;
    communication_style: { tone: string };
  };
}

/* ============================================================
   Agent-to-Agent（Soul Echo）—— 灵魂碰撞 Demo
   ============================================================ */

export interface SoulPersona {
  identity: string;
  traits: string[];
  emotion_pattern: string[];
  interests: string[];
  values: string[];
}

export interface SoulProfile {
  user_id: string;
  name: string;
  history_count: number;
  persona: SoulPersona;
  communication_style: { tone: string };
  generated_by: "ai" | "demo_fallback" | "demo_seed" | string;
  updated_at?: string;
}

export interface SoulMatch {
  user_id: string;
  agent: string;
  score: number;
  reason: string[];
  preview: string;
}

export interface SoulMatchResult {
  id: string;
  user_id: string;
  matches: SoulMatch[];
  created_at: string;
}

export interface SoulDialogueMessage {
  round: number;
  from: string;
  user_id: string;
  text: string;
}

export interface SoulDialogue {
  id: string;
  user_id?: string;
  target_user_id?: string;
  agent_a: string;
  agent_b: string;
  score: number;
  reason: string[];
  conversation: SoulDialogueMessage[];
  echo: string;
  created_at: string;
}

/** 流式碰撞的 NDJSON 事件 */
export type SoulStreamEvent =
  | { type: "start"; data: { agent_a: string; agent_b: string; score: number; reason: string[] } }
  | { type: "message"; data: SoulDialogueMessage }
  | { type: "echo"; data: { echo: string } }
  | { type: "done"; data: { dialogue_id: string; created_at: string } }
  | { type: "error"; data: { message: string } };

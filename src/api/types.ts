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
  error?: { message?: string; remaining_seconds?: number };
}

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

export interface ApiErrorShape {
  error?: { message?: string };
}

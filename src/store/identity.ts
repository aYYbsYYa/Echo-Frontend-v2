import { reactive, readonly } from "vue";
import { api, ApiError } from "../api/client";
import type { Identity } from "../api/types";

const STORAGE_KEY = "echo.identity.v1";

interface IdentityState {
  user: Identity | null;
  /** 是否已完成启动时的身份恢复 */
  ready: boolean;
}

const state = reactive<IdentityState>({ user: null, ready: false });

function persist(user: Identity | null) {
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(STORAGE_KEY);
}

/** 应用启动时恢复本地身份，并与服务端核对 */
async function bootstrap() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const cached = JSON.parse(raw) as Identity;
      const { data } = await api.getUser(cached.id);
      state.user = { ...cached, ...data };
      persist(state.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        persist(null);
        state.user = null;
      } else {
        // 网络异常时先信任本地身份，保证离线可用
        state.user = cached(raw);
      }
    }
  }
  state.ready = true;
}

function cached(raw: string | null): Identity | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Identity;
  } catch {
    return null;
  }
}

function setUser(user: Identity) {
  state.user = user;
  persist(user);
}

export function useIdentity() {
  return {
    state: readonly(state),
    bootstrap,
    setUser,
  };
}

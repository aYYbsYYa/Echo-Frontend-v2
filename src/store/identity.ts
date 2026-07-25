import { reactive, readonly } from "vue";
import { api, ApiError } from "../api/client";
import type { Identity } from "../api/types";

const DEFAULT_USER = {
  id: "demo_user_main",
  nickname: "林间旅人",
  birthday: "2000-01-01",
  gender: "prefer_not_to_say",
  region: "杭州",
  avatar: "林",
} satisfies Identity;

interface IdentityState {
  user: Identity | null;
  /** 是否已完成启动时的身份恢复 */
  ready: boolean;
}

const state = reactive<IdentityState>({ user: null, ready: false });

/** 所有访客共用固定演示账户；后端缺少账户时仅创建身份，不写入模拟内容。 */
async function bootstrap() {
  if (state.ready) return;

  try {
    const { data } = await api.getUser(DEFAULT_USER.id);
    state.user = data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const { data } = await api.createUser(DEFAULT_USER);
      state.user = data;
    } else {
      // 保留页面可用性；具体业务请求仍会提示后端连接问题。
      state.user = DEFAULT_USER;
    }
  } finally {
    state.ready = true;
  }
}

export function useIdentity() {
  return {
    state: readonly(state),
    bootstrap,
  };
}

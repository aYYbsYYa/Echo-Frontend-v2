<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import ForestBackdrop from "../components/ForestBackdrop.vue";
import TreeIcon from "../components/TreeIcon.vue";
import CapsuleComposer from "../components/CapsuleComposer.vue";
import CapsuleOpenStage from "../components/CapsuleOpenStage.vue";
import { api } from "../api/client";
import type { Capsule } from "../api/types";
import { useIdentity } from "../store/identity";
import { pushToast } from "../store/toast";

const router = useRouter();
const identity = useIdentity();
const user = computed(() => identity.state.user);

const capsules = ref<Capsule[]>([]);
const loading = ref(true);
const loadError = ref("");
const composing = ref(false);
const opening = ref<Capsule | null>(null);

/** 本地秒针：让倒计时与"到点点亮"实时发生 */
const nowTick = ref(Date.now());
let ticker: number | undefined;

type TreeState = "locked" | "ready" | "opened";

function stateOf(capsule: Capsule): TreeState {
  if (capsule.opened_at) return "opened";
  return secondsLeft(capsule) <= 0 ? "ready" : "locked";
}

function secondsLeft(capsule: Capsule): number {
  const target = new Date(capsule.unlock_at).getTime();
  if (Number.isNaN(target)) return capsule.remaining_seconds;
  return Math.max(0, Math.ceil((target - nowTick.value) / 1000));
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "时间到了";
  const day = 86_400;
  const hour = 3600;
  if (seconds >= day) return `${Math.floor(seconds / day)} 天`;
  if (seconds >= hour) return `${Math.floor(seconds / hour)} 小时 ${Math.floor((seconds % hour) / 60)} 分`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
  return `${seconds} 秒`;
}

/** 树高随封存时长分档：埋得越久，树越高；自定义时长按总秒数折算 */
function treeSize(capsule: Capsule): number {
  const fixed: Record<string, number> = {
    minute: 40,
    month1: 50,
    month3: 60,
    month6: 72,
    month12: 86,
  };
  if (capsule.duration in fixed) return fixed[capsule.duration];
  const total = (new Date(capsule.unlock_at).getTime() - new Date(capsule.created_at).getTime()) / 1000;
  if (total < 3600) return 40;
  if (total < 86_400) return 45;
  if (total < 30 * 86_400) return 50;
  if (total < 91 * 86_400) return 60;
  if (total < 182 * 86_400) return 72;
  return 86;
}

/** 错落站位，让林地看起来自然生长 */
const offsets = [0, 16, -10, 22, -16, 8, -6, 14, -20, 4];

onMounted(async () => {
  ticker = window.setInterval(() => (nowTick.value = Date.now()), 1000);
  await load();
});

onBeforeUnmount(() => {
  if (ticker) window.clearInterval(ticker);
});

async function load(silent = false) {
  if (!user.value) return;
  if (!silent) {
    loading.value = true;
    loadError.value = "";
  }
  try {
    const { data, meta } = await api.myCapsules(user.value.id);
    capsules.value = data;
    if (meta.unlockable > 0) {
      window.setTimeout(
        () => pushToast(`有 ${meta.unlockable} 封信沉淀好了，点开那棵发光的树。`, "success", 3600),
        900,
      );
    }
  } catch (error) {
    if (!silent) loadError.value = error instanceof Error ? error.message : "加载失败，请再试一次。";
  } finally {
    loading.value = false;
  }
}

function switchMode(next: "ocean" | "sky") {
  router.push(next === "ocean" ? "/" : "/sky");
}

function onBuried(capsule: Capsule) {
  composing.value = false;
  capsules.value = [...capsules.value, capsule].sort((a, b) => a.unlock_at.localeCompare(b.unlock_at));
  pushToast("种子已经入土。时间到了，它会发光。", "success", 3200);
}

function onTreeClick(capsule: Capsule) {
  const state = stateOf(capsule);
  if (state === "locked") {
    pushToast(`还要再等 ${formatRemaining(secondsLeft(capsule))}。好答案值得等待。`, "info", 2600);
    return;
  }
  opening.value = capsule;
}

function onOpened(updated: Capsule) {
  capsules.value = capsules.value.map((c) => (c.id === updated.id ? { ...c, ...updated } : c));
}

function onOpenClosed() {
  opening.value = null;
  load(true);
}
</script>

<template>
  <div class="forest-home">
    <ForestBackdrop />

    <!-- 顶栏 -->
    <header class="topbar">
      <div class="brand">
        <TreeIcon :size="26" class="brand-icon" />
        <span class="serif">Echo · 回响</span>
      </div>

      <nav class="nav">
        <div class="mode-switch">
          <button @click="switchMode('ocean')">海</button>
          <button @click="switchMode('sky')">天</button>
          <button class="active">森</button>
        </div>
        <button class="me" @click="router.push('/mine')" aria-label="查看我的林地">
          <span class="me-avatar">{{ user?.avatar ?? "匿" }}</span>
          <span class="me-name">{{ user?.nickname }}</span>
        </button>
      </nav>
    </header>

    <!-- 中央文案 -->
    <main class="stage-center">
      <div class="hero">
        <h1 class="serif">把今天，说给未来听</h1>
        <p>埋一颗时光种子，等它长成答案</p>
      </div>
    </main>

    <!-- 操作坞 -->
    <footer class="dock">
      <button class="btn btn-primary dock-btn" @click="composing = true">
        <TreeIcon :size="18" />
        埋一颗时光种子
      </button>
    </footer>

    <!-- 时光林地 -->
    <section class="grove" aria-label="我的时光林地">
      <div v-if="loading" class="grove-hint">
        <span class="loader" />
        <p>正在走进林间……</p>
      </div>

      <div v-else-if="loadError" class="grove-hint">
        <p>{{ loadError }}</p>
        <button class="btn btn-ghost" @click="load()">再试一次</button>
      </div>

      <button v-else-if="capsules.length === 0" class="grove-empty" @click="composing = true">
        <span class="empty-ring">
          <TreeIcon :size="30" />
        </span>
        <p class="empty-title">这片林地还空着</p>
        <p class="empty-sub">埋下第一颗种子，时间会让它发芽</p>
      </button>

      <TransitionGroup v-else name="trees" tag="div" class="grove-trees">
        <button
          v-for="(capsule, index) in capsules"
          :key="capsule.id"
          class="grove-tree"
          :class="stateOf(capsule)"
          :style="{
            '--tree-size': treeSize(capsule) + 'px',
            '--tree-offset': offsets[index % offsets.length] + 'px',
          }"
          :aria-label="
            stateOf(capsule) === 'locked'
              ? `未解锁，还剩 ${formatRemaining(secondsLeft(capsule))}`
              : stateOf(capsule) === 'ready'
                ? '可以打开了'
                : '已开启，可回看'
          "
          @click="onTreeClick(capsule)"
        >
          <span class="tree-halo" />
          <span class="tree-shape" />
          <span class="tree-tag">
            <template v-if="stateOf(capsule) === 'locked'">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              {{ formatRemaining(secondsLeft(capsule)) }}
            </template>
            <template v-else-if="stateOf(capsule) === 'ready'">
              <span class="dot" />
              可以打开了
            </template>
            <template v-else> 已开启 · 回看 </template>
          </span>
        </button>
      </TransitionGroup>
    </section>

    <!-- 浮层 -->
    <CapsuleComposer
      v-if="composing && user"
      :user-id="user.id"
      :nickname="user.nickname"
      @close="composing = false"
      @buried="onBuried"
    />
    <CapsuleOpenStage
      v-if="opening && user"
      :capsule="opening"
      :user-id="user.id"
      @close="onOpenClosed"
      @opened="onOpened"
    />
  </div>
</template>

<style scoped>
.forest-home {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ---------------- 顶栏 ---------------- */

.topbar {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 28px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  letter-spacing: 0.14em;
}

.brand-icon {
  color: #a8d8a0;
}

.nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-switch {
  display: flex;
  padding: 4px;
  gap: 2px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(10px);
}

.mode-switch button {
  padding: 7px 16px;
  border-radius: 999px;
  font-size: 13.5px;
  letter-spacing: 0.14em;
  color: var(--ink-dim);
  transition:
    background 0.3s ease,
    color 0.3s ease;
}

.mode-switch button.active {
  background: rgba(255, 255, 255, 0.14);
  color: var(--ink);
}

.me {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 14px 5px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(10px);
  transition: background 0.3s ease;
}

.me:hover {
  background: rgba(255, 255, 255, 0.12);
}

.me-avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #b8dfa8, #6faf68);
  color: #173010;
  font-size: 14px;
  font-weight: 700;
}

.me-name {
  font-size: 13.5px;
  letter-spacing: 0.06em;
  color: var(--ink-dim);
  max-width: 90px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------------- 中央文案（与海/天页一致） ---------------- */

.stage-center {
  position: relative;
  z-index: 4;
  flex: 1;
  display: grid;
  place-items: center;
  padding: 0 24px;
  pointer-events: none;
}

.hero {
  text-align: center;
  transform: translateY(-6vh);
}

.hero h1 {
  margin: 0;
  font-size: clamp(30px, 6vw, 52px);
  font-weight: 600;
  letter-spacing: 0.22em;
  text-indent: 0.22em;
  text-shadow: 0 4px 30px rgba(2, 12, 8, 0.7);
  animation: hero-in 0.9s var(--ease-out);
}

.hero p {
  margin: 18px 0 0;
  font-size: clamp(13px, 2vw, 15px);
  letter-spacing: 0.3em;
  text-indent: 0.3em;
  color: var(--ink-dim);
  animation: hero-in 0.9s var(--ease-out) 0.12s backwards;
}

@keyframes hero-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}

/* ---------------- 操作坞（与海/天页一致的悬浮位置） ---------------- */

.dock {
  position: fixed;
  left: 0;
  right: 0;
  top: 68%;
  z-index: 5;
  display: flex;
  justify-content: center;
  padding: 0 20px;
  animation: dock-in 0.9s var(--ease-out) 0.25s backwards;
}

@keyframes dock-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}

.dock-btn {
  min-width: 210px;
}

/* ---------------- 时光林地（底部横带） ---------------- */

.grove {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 20px 1.6vh;
  min-height: 24vh;
  pointer-events: none;
}

.grove > * {
  pointer-events: auto;
}

.grove-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--ink-dim);
  font-size: 13.5px;
  letter-spacing: 0.12em;
  padding-bottom: 4vh;
}

.loader {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid rgba(236, 245, 246, 0.18);
  border-top-color: #a8d8a0;
  animation: spin 0.9s linear infinite;
}

/* 空林地 */
.grove-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-bottom: 3.4vh;
  color: var(--ink-dim);
  transition: transform 0.35s var(--ease-spring);
}

.grove-empty:hover {
  transform: translateY(-3px);
}

.empty-ring {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  margin-bottom: 8px;
  border-radius: 50%;
  border: 1.5px dashed rgba(168, 216, 160, 0.5);
  color: #a8d8a0;
  animation: ring-breathe 3.2s ease-in-out infinite;
}

@keyframes ring-breathe {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(168, 216, 160, 0.16);
  }
  50% {
    box-shadow: 0 0 0 14px rgba(168, 216, 160, 0);
  }
}

.empty-title {
  margin: 0;
  font-size: 15px;
  letter-spacing: 0.2em;
  color: var(--ink);
}

.empty-sub {
  margin: 0;
  font-size: 12.5px;
  letter-spacing: 0.14em;
}

/* 树群：底部横向生长，超出可左右滑动 */
.grove-trees {
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  flex-wrap: nowrap;
  gap: clamp(18px, 3.6vw, 46px);
  max-width: 100%;
  overflow-x: auto;
  padding: 20px 12px 0;
  scrollbar-width: none;
}

.grove-trees::-webkit-scrollbar {
  display: none;
}

.grove-tree {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 6px 4px 0;
  transform: translateY(var(--tree-offset));
  transition: transform 0.4s var(--ease-spring);
}

.grove-tree:hover {
  transform: translateY(calc(var(--tree-offset) - 6px));
}

/* 树形（clip-path 松树） */
.tree-shape {
  position: relative;
  z-index: 1;
  width: var(--tree-size);
  height: calc(var(--tree-size) * 1.24);
  clip-path: polygon(
    50% 0%, 68% 26%, 60% 26%, 78% 52%, 68% 52%, 88% 82%, 56% 82%, 56% 100%,
    44% 100%, 44% 82%, 12% 82%, 32% 52%, 22% 52%, 40% 26%, 32% 26%
  );
  transition: filter 0.5s ease, background 0.5s ease;
}

/* 状态：仍在沉淀 */
.locked .tree-shape {
  background: linear-gradient(180deg, #2a5c40 0%, #12291b 100%);
  filter: drop-shadow(0 6px 14px rgba(2, 12, 8, 0.5));
}

/* 状态：可以打开（发光摇曳） */
.ready .tree-shape {
  background: linear-gradient(180deg, #b9e7a2 0%, #3f7d4e 100%);
  filter: drop-shadow(0 0 18px rgba(185, 231, 162, 0.55));
  animation: tree-sway 2.8s ease-in-out infinite;
}

@keyframes tree-sway {
  0%,
  100% {
    transform: rotate(-1.6deg);
  }
  50% {
    transform: rotate(1.6deg);
  }
}

/* 状态：已开启 */
.opened .tree-shape {
  background: linear-gradient(180deg, #7fae83 0%, #234a2e 100%);
  filter: drop-shadow(0 0 10px rgba(168, 216, 160, 0.28));
}

/* 光晕（仅 ready 可见） */
.tree-halo {
  position: absolute;
  left: 50%;
  top: 44%;
  z-index: 0;
  width: calc(var(--tree-size) * 1.9);
  height: calc(var(--tree-size) * 1.9);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(216, 247, 168, 0.22) 0%, transparent 66%);
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.5s ease;
}

.ready .tree-halo {
  opacity: 1;
  animation: halo-pulse 2.8s ease-in-out infinite;
}

@keyframes halo-pulse {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(0.92);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.08);
  }
}

/* 树下标签 */
.tree-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 11.5px;
  letter-spacing: 0.06em;
  white-space: nowrap;
  background: rgba(4, 18, 12, 0.62);
  border: 1px solid rgba(236, 245, 246, 0.12);
  backdrop-filter: blur(8px);
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
  transition:
    color 0.4s ease,
    border-color 0.4s ease,
    background 0.4s ease;
}

.ready .tree-tag {
  color: #e4f7cf;
  border-color: rgba(216, 247, 168, 0.45);
  background: rgba(38, 68, 26, 0.6);
}

.tree-tag .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d8f7a8;
  box-shadow: 0 0 6px 2px rgba(216, 247, 168, 0.6);
  animation: dot-blink 1.4s ease-in-out infinite;
}

@keyframes dot-blink {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

/* 树入场 */
.trees-enter-active {
  transition:
    opacity 0.6s var(--ease-out),
    transform 0.6s var(--ease-spring);
}

.trees-enter-from {
  opacity: 0;
  transform: translateY(calc(var(--tree-offset) + 26px)) scale(0.7);
}

.trees-move {
  transition: transform 0.5s ease;
}

@media (max-width: 560px) {
  .topbar {
    padding: 16px;
  }
  .me-name {
    display: none;
  }
  .hero h1 {
    letter-spacing: 0.14em;
  }
  .dock-btn {
    min-width: 0;
    width: min(320px, 86vw);
  }
}
</style>

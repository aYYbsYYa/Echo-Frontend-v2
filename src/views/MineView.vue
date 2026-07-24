<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import OceanBackdrop from "../components/OceanBackdrop.vue";
import SkyBackdrop from "../components/SkyBackdrop.vue";
import ForestBackdrop from "../components/ForestBackdrop.vue";
import BottleIcon from "../components/BottleIcon.vue";
import PlaneIcon from "../components/PlaneIcon.vue";
import TreeIcon from "../components/TreeIcon.vue";
import { api } from "../api/client";
import type { Bottle, BottleScene, Capsule, Plane, PlaneScene } from "../api/types";
import { useIdentity } from "../store/identity";
import { pushToast } from "../store/toast";
import { timeAgo } from "../utils/time";

const router = useRouter();
const identity = useIdentity();
const user = computed(() => identity.state.user);

const tab = ref<"bottle" | "plane" | "capsule">("bottle");
const loading = ref(true);
const loadError = ref("");
const bottles = ref<Bottle[]>([]);
const planes = ref<Plane[]>([]);
const capsules = ref<Capsule[]>([]);
const expanded = ref<string | null>(null);

const bottleSceneLabels: Record<BottleScene, string> = {
  shallow: "浮在浅滩",
  deep: "漂向深海",
  drift: "随波逐流",
};

const planeSceneLabels: Record<PlaneScene, string> = {
  sky: "落在云端",
  window: "停在窗台",
  tree: "挂上树梢",
};

const list = computed(() => (tab.value === "bottle" ? bottles.value : planes.value));

onMounted(load);

async function load() {
  if (!user.value) return;
  loading.value = true;
  loadError.value = "";
  try {
    const [b, p, c] = await Promise.all([
      api.myBottles(user.value.id),
      api.myPlanes(user.value.id),
      api.myCapsules(user.value.id),
    ]);
    bottles.value = b.data;
    planes.value = p.data;
    capsules.value = c.data;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "加载失败，请再试一次。";
  } finally {
    loading.value = false;
  }
}

function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id;
}

/* ---------------- 时光胶囊 ---------------- */

type CapsuleState = "locked" | "ready" | "opened";

function capsuleState(entry: Capsule): CapsuleState {
  if (entry.opened_at) return "opened";
  return entry.remaining_seconds <= 0 || entry.is_unlocked ? "ready" : "locked";
}

function capsuleStateLabel(entry: Capsule): string {
  const state = capsuleState(entry);
  if (state === "locked") return "沉淀中";
  if (state === "ready") return "可以打开了";
  return "已开启";
}

function capsuleRemaining(entry: Capsule): string {
  const seconds = entry.remaining_seconds;
  if (seconds >= 86_400) return `还剩 ${Math.floor(seconds / 86_400)} 天`;
  if (seconds >= 3600) return `还剩 ${Math.floor(seconds / 3600)} 小时`;
  if (seconds >= 60) return `还剩 ${Math.floor(seconds / 60)} 分钟`;
  return `还剩 ${Math.max(1, seconds)} 秒`;
}

function onCapsuleClick(entry: Capsule) {
  const state = capsuleState(entry);
  if (state === "locked") {
    pushToast(`${capsuleRemaining(entry)}。时间没到，谁也打不开。`, "info");
    return;
  }
  if (state === "ready") {
    router.push("/forest");
  }
  // 已开启的信直接展示在卡片上，无需额外操作
}
</script>

<template>
  <div class="mine">
    <!-- 背景随页签切换：浮笺=海 / 飞笺=天 / 树洞=森 -->
    <Transition name="scene">
      <OceanBackdrop v-if="tab === 'bottle'" dim key="ocean" />
      <SkyBackdrop v-else-if="tab === 'plane'" dim key="sky" />
      <ForestBackdrop v-else dim key="forest" />
    </Transition>

    <header class="topbar">
      <button class="back" @click="router.push('/')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        回到海边
      </button>
      <h1 class="serif">我的海与风</h1>
      <span class="spacer" />
    </header>

    <main class="content">
      <!-- 身份卡 -->
      <section v-if="user" class="who glass-card">
        <span class="who-avatar">{{ user.avatar }}</span>
        <div class="who-meta">
          <b>{{ user.nickname }}</b>
          <span>{{ user.region || "未标注" }} · 匿名旅人</span>
        </div>
        <div class="who-counts">
          <span><b>{{ bottles.length }}</b> 只瓶</span>
          <span><b>{{ planes.length }}</b> 张飞笺</span>
          <span><b>{{ capsules.length }}</b> 棵树</span>
        </div>
      </section>

      <!-- 页签 -->
      <div class="tabs">
        <button :class="{ active: tab === 'bottle' }" @click="tab = 'bottle'">
          <BottleIcon :size="16" /> 浮笺
        </button>
        <button :class="{ active: tab === 'plane' }" @click="tab = 'plane'">
          <PlaneIcon :size="16" /> 飞笺
        </button>
        <button :class="{ active: tab === 'capsule' }" @click="tab = 'capsule'">
          <TreeIcon :size="16" /> 树洞
        </button>
      </div>

      <!-- 加载 / 出错 -->
      <div v-if="loading" class="hint-box">
        <span class="loader" />
        <p>正在清点海面……</p>
      </div>
      <div v-else-if="loadError" class="hint-box">
        <p>{{ loadError }}</p>
        <button class="btn btn-ghost" @click="load">再试一次</button>
      </div>

      <!-- 空态：胶囊 -->
      <div v-else-if="tab === 'capsule' && capsules.length === 0" class="hint-box">
        <TreeIcon :size="42" class="hint-icon forest-icon" />
        <p>你的林地还空着，埋一颗时光种子吧。</p>
        <button class="btn btn-primary" @click="router.push('/forest')">去森林里</button>
      </div>

      <!-- 空态：浮笺/飞笺 -->
      <div v-else-if="tab !== 'capsule' && list.length === 0" class="hint-box">
        <BottleIcon v-if="tab === 'bottle'" :size="42" class="hint-icon" />
        <PlaneIcon v-else :size="42" class="hint-icon" />
        <p>{{ tab === "bottle" ? "你还没有扔出浮笺。" : "你还没有折过飞笺。" }}</p>
        <button class="btn btn-primary" @click="router.push(tab === 'bottle' ? '/' : '/sky')">
          {{ tab === "bottle" ? "去扔一张" : "去折一张" }}
        </button>
      </div>

      <!-- 列表：胶囊 -->
      <TransitionGroup v-else-if="tab === 'capsule'" name="cards" tag="section" class="cards">
        <article
          v-for="entry in capsules"
          :key="entry.id"
          class="card glass-card"
          :class="{ clickable: capsuleState(entry) !== 'opened' }"
        >
          <button class="card-main" @click="onCapsuleClick(entry)">
            <header class="card-head">
              <span class="badge capsule" :class="capsuleState(entry)">
                {{ capsuleStateLabel(entry) }}
              </span>
              <time>写于 {{ timeAgo(entry.created_at) }}</time>
            </header>
            <p v-if="capsuleState(entry) === 'locked'" class="card-content capsule-sealed">
              这封信还在时间里沉睡，{{ capsuleRemaining(entry) }}。
            </p>
            <p v-else-if="capsuleState(entry) === 'ready'" class="card-content capsule-ready-text">
              时间到了。去森林里，点开那棵发光的树。
            </p>
            <p v-else class="card-content">{{ entry.content }}</p>
            <img
              v-if="entry.has_image && capsuleState(entry) === 'opened' && user"
              class="capsule-photo"
              :src="api.capsuleImageUrl(entry.id, user.id)"
              alt="随信封存的照片"
              loading="lazy"
            />
            <footer class="card-stats">
              <span v-if="entry.has_image && capsuleState(entry) === 'locked'" class="photo-hint">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <circle cx="9" cy="10" r="1.6" />
                  <path d="m5 17 4.5-4.5 3 3L16 12l3 3" />
                </svg>
                有一张照片在沉睡
              </span>
              <span>封存 {{ entry.duration_label }}</span>
              <span v-if="capsuleState(entry) === 'opened'">沉淀了 {{ entry.waited_label }}</span>
              <span v-if="capsuleState(entry) === 'ready'">点击前往森林 →</span>
            </footer>
          </button>
        </article>
      </TransitionGroup>

      <!-- 列表：浮笺/飞笺 -->
      <TransitionGroup v-else name="cards" tag="section" class="cards">
        <article v-for="entry in list" :key="entry.id" class="card glass-card">
          <button class="card-main" @click="toggle(entry.id)">
            <header class="card-head">
              <span class="badge" :class="entry.type">
                {{
                  entry.type === "bottle"
                    ? bottleSceneLabels[(entry as Bottle).scene]
                    : planeSceneLabels[(entry as Plane).scene]
                }}
              </span>
              <time>{{ timeAgo(entry.created_at) }}</time>
            </header>
            <p class="card-content">{{ entry.content }}</p>
            <img v-if="entry.image_url" :src="entry.image_url" class="card-thumb" alt="附图" loading="lazy" />
            <footer class="card-stats">
              <span :title="entry.type === 'bottle' ? '被捞起的次数' : '被接住的次数'">
                {{ entry.type === "bottle" ? "被拾起" : "停留" }} {{ entry.views }} 次
              </span>
              <span>心意 {{ entry.likes ?? 0 }}</span>
              <span>留言 {{ entry.comments?.length ?? 0 }}</span>
              <svg class="chev" :class="{ open: expanded === entry.id }" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </footer>
          </button>

          <Transition name="detail">
            <div v-if="expanded === entry.id" class="card-detail">
              <blockquote v-if="entry.reply" class="reply">
                <span class="reply-tag">开发组回信</span>
                <p>{{ entry.reply }}</p>
              </blockquote>

              <div v-if="entry.comments?.length" class="comments">
                <p v-for="comment in entry.comments" :key="comment.id" class="comment">
                  <span class="comment-text">{{ comment.content }}</span>
                  <span class="comment-meta">来自 {{ comment.nickname }} · {{ timeAgo(comment.created_at) }}</span>
                </p>
              </div>
              <p v-else-if="!entry.reply" class="nothing">还没有回响，潮水会把它带到。</p>
            </div>
          </Transition>
        </article>
      </TransitionGroup>
    </main>
  </div>
</template>

<style scoped>
.mine {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
}

/* 背景随页签淡入淡出 */
.scene-enter-active {
  transition: opacity 0.55s ease;
}

.scene-leave-active {
  transition: opacity 0.3s ease;
}

.scene-enter-from,
.scene-leave-to {
  opacity: 0;
}

/* ---------------- 顶栏 ---------------- */

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 26px;
  background: linear-gradient(180deg, rgba(3, 10, 18, 0.72), transparent);
  backdrop-filter: blur(8px);
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--ink-dim);
  padding: 8px 14px 8px 8px;
  border-radius: 999px;
  transition:
    color 0.25s ease,
    background 0.25s ease;
}

.back:hover {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.08);
}

.topbar h1 {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.2em;
}

.spacer {
  width: 92px;
}

/* ---------------- 内容 ---------------- */

.content {
  position: relative;
  z-index: 1;
  width: min(680px, 100%);
  margin: 0 auto;
  padding: 8px 20px 80px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.who {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
}

.who-avatar {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f7ca92, #eb9f58);
  color: #40290f;
  font-size: 23px;
  font-weight: 700;
  flex: none;
}

.who-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.who-meta b {
  font-size: 17px;
  letter-spacing: 0.05em;
}

.who-meta span {
  font-size: 12.5px;
  color: var(--ink-dim);
}

.who-counts {
  margin-left: auto;
  display: flex;
  gap: 14px;
  font-size: 13px;
  color: var(--ink-dim);
  white-space: nowrap;
}

.who-counts b {
  color: var(--amber);
  font-size: 17px;
  margin-right: 2px;
}

/* ---------------- 页签 ---------------- */

.tabs {
  display: flex;
  gap: 10px;
}

.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 20px;
  border-radius: 999px;
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--ink-dim);
  border: 1px solid transparent;
  transition: all 0.3s ease;
}

.tabs button.active {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--glass-border);
}

/* ---------------- 提示 ---------------- */

.hint-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 20px;
  text-align: center;
  color: var(--ink-dim);
}

.hint-icon {
  color: rgba(159, 224, 216, 0.55);
}

.loader {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid rgba(159, 224, 216, 0.25);
  border-top-color: var(--teal);
  animation: spin 0.9s linear infinite;
}

/* ---------------- 卡片 ---------------- */

.cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card {
  overflow: hidden;
}

.card.clickable .card-main {
  cursor: pointer;
}

.card:not(.clickable) .card-main {
  cursor: default;
}

.card-main {
  display: block;
  width: 100%;
  text-align: left;
  padding: 18px 20px 14px;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.badge {
  font-size: 11.5px;
  letter-spacing: 0.12em;
  padding: 4px 11px;
  border-radius: 999px;
}

.badge.bottle {
  color: var(--teal);
  border: 1px solid rgba(127, 212, 201, 0.4);
}

.badge.plane {
  color: #ffd9ae;
  border: 1px solid rgba(255, 217, 174, 0.4);
}

.badge.capsule.locked {
  color: #a8d8a0;
  border: 1px solid rgba(168, 216, 160, 0.35);
}

.badge.capsule.ready {
  color: #e4f7cf;
  border: 1px solid rgba(216, 247, 168, 0.6);
  background: rgba(216, 247, 168, 0.1);
}

.badge.capsule.opened {
  color: var(--ink-dim);
  border: 1px solid var(--glass-border);
}

.forest-icon {
  color: rgba(168, 216, 160, 0.55);
}

.capsule-sealed {
  color: var(--ink-faint);
  font-style: italic;
  letter-spacing: 0.04em;
}

.capsule-ready-text {
  color: #e4f7cf;
  letter-spacing: 0.04em;
}

.capsule-photo {
  display: block;
  max-width: min(280px, 100%);
  margin: 4px 14px 4px;
  border-radius: 10px;
  border: 1px solid var(--glass-border);
  box-shadow: 0 8px 22px rgba(2, 12, 9, 0.35);
}

.photo-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #a8d8a0;
}

.card-head time {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink-faint);
}

.card-content {
  margin: 0;
  font-size: 15.5px;
  line-height: 26px;
  color: var(--ink);
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-thumb {
  margin-top: 12px;
  width: 100%;
  max-height: 180px;
  object-fit: cover;
  border-radius: 12px;
}

.card-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed rgba(236, 245, 246, 0.14);
  font-size: 12.5px;
  color: var(--ink-dim);
}

.chev {
  margin-left: auto;
  transition: transform 0.3s ease;
}

.chev.open {
  transform: rotate(180deg);
}

/* ---------------- 展开详情 ---------------- */

.card-detail {
  padding: 0 20px 18px;
  overflow: hidden;
}

.reply {
  margin: 4px 0 14px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(240, 181, 122, 0.1);
  border: 1px solid rgba(240, 181, 122, 0.3);
}

.reply-tag {
  display: inline-block;
  font-size: 11.5px;
  letter-spacing: 0.16em;
  color: var(--amber);
  margin-bottom: 6px;
}

.reply p {
  margin: 0;
  font-size: 14px;
  line-height: 24px;
  color: var(--ink);
  white-space: pre-wrap;
}

.comments {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.comment {
  margin: 0;
  padding: 11px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(236, 245, 246, 0.08);
}

.comment-text {
  display: block;
  font-size: 14px;
  line-height: 23px;
  color: var(--ink);
  white-space: pre-wrap;
}

.comment-meta {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  color: var(--ink-faint);
}

.nothing {
  margin: 6px 0 2px;
  font-size: 13px;
  color: var(--ink-faint);
  letter-spacing: 0.06em;
}

.detail-enter-active,
.detail-leave-active {
  transition: all 0.35s var(--ease-out);
}
.detail-enter-from,
.detail-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.cards-enter-active {
  transition: all 0.45s var(--ease-out);
}
.cards-enter-from {
  opacity: 0;
  transform: translateY(18px);
}

@media (max-width: 560px) {
  .spacer {
    width: 0;
  }
  .topbar h1 {
    font-size: 17px;
  }
  .who-counts {
    flex-direction: column;
    gap: 2px;
  }
}
</style>

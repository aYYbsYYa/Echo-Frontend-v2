<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import OceanBackdrop from "../components/OceanBackdrop.vue";
import BottleIcon from "../components/BottleIcon.vue";
import PlaneIcon from "../components/PlaneIcon.vue";
import { api } from "../api/client";
import type { Bottle, Plane, PlaneScene } from "../api/types";
import { useIdentity } from "../store/identity";
import { timeAgo } from "../utils/time";

const router = useRouter();
const identity = useIdentity();
const user = computed(() => identity.state.user);

const tab = ref<"bottle" | "plane">("bottle");
const loading = ref(true);
const loadError = ref("");
const bottles = ref<Bottle[]>([]);
const planes = ref<Plane[]>([]);
const expanded = ref<string | null>(null);

const sceneLabels: Record<PlaneScene, string> = {
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
    const [b, p] = await Promise.all([api.myBottles(user.value.id), api.myPlanes(user.value.id)]);
    bottles.value = b.data;
    planes.value = p.data;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "加载失败，请再试一次。";
  } finally {
    loading.value = false;
  }
}

function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id;
}
</script>

<template>
  <div class="mine">
    <OceanBackdrop dim />

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

      <!-- 空态 -->
      <div v-else-if="list.length === 0" class="hint-box">
        <BottleIcon v-if="tab === 'bottle'" :size="42" class="hint-icon" />
        <PlaneIcon v-else :size="42" class="hint-icon" />
        <p>{{ tab === "bottle" ? "你还没有扔出浮笺。" : "你还没有折过飞笺。" }}</p>
        <button class="btn btn-primary" @click="router.push(tab === 'bottle' ? '/' : '/sky')">
          {{ tab === "bottle" ? "去扔一张" : "去折一张" }}
        </button>
      </div>

      <!-- 列表 -->
      <TransitionGroup v-else name="cards" tag="section" class="cards">
        <article v-for="entry in list" :key="entry.id" class="card glass-card">
          <button class="card-main" @click="toggle(entry.id)">
            <header class="card-head">
              <span class="badge" :class="entry.type">
                {{ entry.type === "bottle" ? "浮笺" : sceneLabels[(entry as Plane).scene] }}
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

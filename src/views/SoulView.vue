<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import SoulBackdrop from "../components/SoulBackdrop.vue";
import SoulIcon from "../components/SoulIcon.vue";
import SoulDialogueStage from "../components/SoulDialogueStage.vue";
import SharedNavigation from "../components/SharedNavigation.vue";
import { api } from "../api/client";
import type { SoulDialogue, SoulMatch, SoulMatchResult, SoulProfile } from "../api/types";
import { useIdentity } from "../store/identity";
import { pushToast } from "../store/toast";
import { timeAgo } from "../utils/time";

const router = useRouter();
const identity = useIdentity();
const user = computed(() => identity.state.user);

const soulUserId = computed(() => user.value?.id ?? "");

/* ---------------- 灵魂画像 ---------------- */

const profile = ref<SoulProfile | null>(null);
const profileLoading = ref(true);
const profileError = ref("");
const profileRefreshing = ref(false);

const GENERATED_LABELS: Record<string, string> = {
  echo_profile: "灵笺画像",
  ai: "AI 提炼",
  demo_fallback: "Demo 兜底",
  demo_seed: "Demo 预置",
};

const needsEchoProfile = computed(() => !profileLoading.value && !profile.value && Boolean(profileError.value));

const personaGroups = computed(() => {
  const p = profile.value?.persona;
  if (!p) return [];
  return [
    { label: "特质", items: p.traits },
    { label: "心绪", items: p.emotion_pattern },
    { label: "热爱", items: p.interests },
    { label: "珍视", items: p.values },
  ].filter((g) => g.items.length > 0);
});

async function loadProfile() {
  profileLoading.value = true;
  profileError.value = "";
  profile.value = null;
  if (!soulUserId.value) {
    profileError.value = "请先选择或创建你的身份。";
    profileLoading.value = false;
    return;
  }
  try {
    const { data } = await api.getSoulProfile(soulUserId.value);
    profile.value = data;
  } catch (error) {
    profileError.value = error instanceof Error ? error.message : "画像暂时没有成形。";
  } finally {
    profileLoading.value = false;
  }
}

async function refreshProfile() {
  if (profileRefreshing.value) return;
  profileRefreshing.value = true;
  try {
    await api.refreshEchoProfile(soulUserId.value);
    const { data } = await api.getSoulProfile(soulUserId.value);
    profile.value = data;
    pushToast("画像已从灵笺重新提炼。", "success");
  } catch (error) {
    pushToast(error instanceof Error ? error.message : "提炼失败，请稍后再试。", "error");
  } finally {
    profileRefreshing.value = false;
  }
}

/* ---------------- 灵魂匹配 ---------------- */

const matching = ref(false);
const matchError = ref("");
const matchResult = ref<SoulMatchResult | null>(null);

const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;
const ringsLive = ref(false);
const shownScores = ref<Record<string, number>>({});

function ringOffset(score: number): number {
  return ringsLive.value ? RING_C * (1 - Math.min(100, score) / 100) : RING_C;
}

function scoreTone(score: number): string {
  if (score >= 75) return "#f0b57a";
  if (score >= 55) return "#7fd4c9";
  return "#b9c2d6";
}

function animateScores(matches: SoulMatch[]) {
  const start = performance.now();
  const duration = 1150;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const map: Record<string, number> = {};
    for (const m of matches) map[m.user_id] = Math.round(m.score * eased);
    shownScores.value = map;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function startMatch() {
  if (matching.value || !profile.value || !soulUserId.value) return;
  matching.value = true;
  matchError.value = "";
  matchResult.value = null;
  ringsLive.value = false;
  shownScores.value = {};
  try {
    const { data } = await api.matchSouls(soulUserId.value, 3);
    matchResult.value = data;
    await nextTick();
    window.setTimeout(() => {
      ringsLive.value = true;
      animateScores(data.matches);
    }, 150);
  } catch (error) {
    matchError.value = error instanceof Error ? error.message : "星空中暂时没有回音。";
  } finally {
    matching.value = false;
  }
}

/* ---------------- 碰撞舞台 ---------------- */

const stageTarget = ref<{ targetUserId?: string } | null>(null);

function collide(targetUserId?: string) {
  stageTarget.value = { targetUserId };
}

function onStageFinished() {
  pushToast("回响已经生成，正在收入历史……", "success");
}

function onStageClose(completed: boolean) {
  stageTarget.value = null;
  if (completed) {
    void loadHistory();
  } else {
    pushToast("这次碰撞中途收起，未被保存。", "info");
  }
}

/* ---------------- 历史回响 ---------------- */

const historyList = ref<SoulDialogue[]>([]);
const historyLoading = ref(true);
const historyError = ref("");
const expandedId = ref<string | null>(null);
const confirmingDelete = ref<string | null>(null);
const deleting = ref(false);

async function loadHistory() {
  historyLoading.value = true;
  historyError.value = "";
  try {
    if (!soulUserId.value) return;
    const { data } = await api.listSoulDialogues(soulUserId.value);
    historyList.value = data;
  } catch (error) {
    historyError.value = error instanceof Error ? error.message : "历史回响暂时无法抵达。";
  } finally {
    historyLoading.value = false;
  }
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

function requestDelete(id: string) {
  confirmingDelete.value = id;
  window.setTimeout(() => {
    if (confirmingDelete.value === id) confirmingDelete.value = null;
  }, 3200);
}

async function confirmDelete(item: SoulDialogue) {
  if (deleting.value) return;
  deleting.value = true;
  try {
    await api.deleteSoulDialogue(soulUserId.value, item.id);
    historyList.value = historyList.value.filter((d) => d.id !== item.id);
    confirmingDelete.value = null;
    pushToast("这段回响已随风散去。", "info");
  } catch (error) {
    pushToast(error instanceof Error ? error.message : "删除失败，请再试一次。", "error");
  } finally {
    deleting.value = false;
  }
}

function isOwnSide(item: SoulDialogue, userId: string): boolean {
  return userId === item.user_id;
}

/* ---------------- 生命周期 ---------------- */

watch(soulUserId, () => {
  matchResult.value = null;
  matchError.value = "";
  expandedId.value = null;
  confirmingDelete.value = null;
  void loadProfile();
  void loadHistory();
});

onMounted(() => {
  void loadProfile();
  void loadHistory();
});

function goto(path: string) {
  router.push(path);
}
</script>

<template>
  <div class="soul-page">
    <SoulBackdrop />

    <!-- 顶栏 -->
    <header class="topbar">
      <div class="brand">
        <SoulIcon :size="26" class="brand-icon" />
        <span class="serif">Soul Echo · 灵魂回响</span>
      </div>

      <nav class="nav">
        <SharedNavigation />
        <button class="me" @click="router.push('/mine')" aria-label="查看我的海与风">
          <span class="me-avatar">{{ user?.avatar ?? "匿" }}</span>
          <span class="me-name">{{ user?.nickname }}</span>
        </button>
      </nav>
    </header>

    <main class="soul-main">
      <!-- 标题 -->
      <section class="hero">
        <h1 class="serif">让灵魂，先你一步相遇</h1>
        <p class="sub">Soul Agent 是你长期表达的回声 —— 让它们替你，去星空中碰碰面</p>
      </section>

      <!-- 灵魂画像 -->
      <section class="panel glass-card">
        <header class="panel-head">
          <h2 class="serif">灵魂画像</h2>
          <div class="panel-head-right">
            <span v-if="profile" class="gen-badge">
              {{ GENERATED_LABELS[profile.generated_by] ?? profile.generated_by }}
            </span>
            <button
              class="icon-btn"
              :disabled="profileRefreshing || profileLoading"
              title="重新提炼画像"
              @click="refreshProfile"
            >
              <svg
                viewBox="0 0 24 24" width="15" height="15" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                :class="{ spinning: profileRefreshing }"
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
          </div>
        </header>

        <div v-if="profileLoading" class="panel-hint">
          <span class="loader" />
          <p>正在从长期表达中提炼回声……</p>
        </div>

        <div v-else-if="profileError" class="panel-hint">
          <p>{{ profileError }}</p>
          <button v-if="needsEchoProfile" class="btn btn-primary" @click="goto('/echo')">去灵笺生成画像</button>
          <button v-else class="btn btn-ghost" @click="loadProfile">再试一次</button>
        </div>

        <template v-else-if="profile">
          <blockquote class="identity serif">「{{ profile.persona.identity }}」</blockquote>

          <div class="chip-groups">
            <div v-for="group in personaGroups" :key="group.label" class="chip-group">
              <span class="group-label">{{ group.label }}</span>
              <div class="group-chips">
                <span v-for="item in group.items" :key="item" class="p-chip">{{ item }}</span>
              </div>
            </div>
          </div>

          <p class="tone-line">语气 · {{ profile.communication_style.tone }}</p>
          <p class="profile-foot">由 {{ profile.history_count }} 条长期表达提炼而来</p>
        </template>
      </section>

      <!-- 灵魂匹配 -->
      <section class="panel glass-card">
        <header class="panel-head">
          <h2 class="serif">灵魂匹配</h2>
          <div class="match-actions">
            <button class="btn btn-primary match-btn" :disabled="matching || !profile" @click="startMatch">
              <span v-if="matching" class="btn-loader" />
              {{ matching ? "正在星空中寻找同类……" : matchResult ? "再匹配一次" : "开始灵魂匹配" }}
            </button>
          </div>
        </header>
        <p class="panel-desc">你的 Soul Agent 将与 Sora、Luna、Kai 逐一匹配，并代你进行匿名 Agent 对话。</p>

        <div v-if="matchError" class="panel-hint">
          <p>{{ matchError }}</p>
        </div>

        <TransitionGroup v-else-if="matchResult" name="cards" tag="div" class="match-grid">
          <article
            v-for="(m, i) in matchResult.matches"
            :key="m.user_id"
            class="match-card"
            :style="{ animationDelay: 0.12 * i + 's' }"
          >
            <div class="match-top">
              <svg class="score-ring" viewBox="0 0 72 72">
                <circle class="ring-bg" cx="36" cy="36" :r="RING_R" />
                <circle
                  class="ring-fg"
                  cx="36" cy="36" :r="RING_R"
                  :stroke="scoreTone(m.score)"
                  :stroke-dasharray="RING_C"
                  :stroke-dashoffset="ringOffset(m.score)"
                />
                <text x="36" y="41" class="ring-num" :fill="scoreTone(m.score)">
                  {{ shownScores[m.user_id] ?? 0 }}
                </text>
              </svg>
              <div class="match-agent">
                <b class="serif">{{ m.agent }}</b>
                <span class="match-preview">{{ m.preview }}</span>
              </div>
            </div>

            <div class="match-reasons">
              <span v-for="r in m.reason" :key="r" class="p-chip warm">{{ r }}</span>
            </div>

            <button class="btn btn-primary collide-btn" @click="collide(m.user_id)">
              让两个灵魂碰一碰
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </article>
        </TransitionGroup>

        <div v-else-if="!matching" class="panel-hint dim-hint">
          <p v-if="profile">按下按钮，让你的 Soul Agent 去星空中寻找契合的回声。</p>
          <p v-else>先在灵笺中形成用户画像，才能开始灵魂匹配。</p>
        </div>
      </section>

      <!-- 历史回响 -->
      <section class="history-sec">
        <h2 class="sec-title serif">历史回响</h2>

        <div v-if="historyLoading" class="panel-hint">
          <span class="loader" />
          <p>正在打捞过往的回响……</p>
        </div>

        <div v-else-if="historyError" class="panel-hint">
          <p>{{ historyError }}</p>
          <button class="btn btn-ghost" @click="loadHistory">再试一次</button>
        </div>

        <p v-else-if="historyList.length === 0" class="history-empty">
          还没有回响。让两个灵魂碰一次，第一句话就会留在这里。
        </p>

        <TransitionGroup v-else name="cards" tag="div" class="history-list">
          <article v-for="item in historyList" :key="item.id" class="history-card glass-card">
            <button class="history-summary" @click="toggleExpand(item.id)">
              <span class="history-agents serif">{{ item.agent_a }} × {{ item.agent_b }}</span>
              <span class="history-meta">
                <span class="score-badge" :style="{ color: scoreTone(item.score), borderColor: scoreTone(item.score) + '55' }">
                  契合 {{ item.score }}
                </span>
                <span class="history-time">{{ timeAgo(item.created_at) }}</span>
                <svg
                  class="chev" :class="{ open: expandedId === item.id }"
                  viewBox="0 0 24 24" width="16" height="16" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </button>

            <div v-if="expandedId === item.id" class="history-detail">
              <div v-if="item.reason.length" class="match-reasons">
                <span v-for="r in item.reason" :key="r" class="p-chip warm">{{ r }}</span>
              </div>

              <div class="replay">
                <div
                  v-for="(msg, i) in item.conversation"
                  :key="i"
                  class="replay-row"
                  :class="isOwnSide(item, msg.user_id) ? 'side-a' : 'side-b'"
                >
                  <span class="replay-name">{{ msg.from }}</span>
                  <p class="replay-text">{{ msg.text }}</p>
                </div>
              </div>

              <blockquote v-if="item.echo" class="history-echo serif">{{ item.echo }}</blockquote>

              <div class="history-actions">
                <button
                  v-if="confirmingDelete !== item.id"
                  class="delete-btn"
                  @click.stop="requestDelete(item.id)"
                >
                  删去这段回响
                </button>
                <button
                  v-else
                  class="delete-btn confirming"
                  :disabled="deleting"
                  @click.stop="confirmDelete(item)"
                >
                  {{ deleting ? "正在散去……" : "确认删去？" }}
                </button>
              </div>
            </div>
          </article>
        </TransitionGroup>
      </section>
    </main>

    <!-- 碰撞舞台 -->
    <SoulDialogueStage
      v-if="stageTarget"
      :user-id="soulUserId"
      :target-user-id="stageTarget.targetUserId"
      @close="onStageClose"
      @finished="onStageFinished"
    />
  </div>
</template>

<style scoped>
.soul-page {
  position: relative;
  min-height: 100vh;
  color: var(--ink);
}

/* ---------------- 顶栏 ---------------- */

.topbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 28px;
  background: linear-gradient(180deg, rgba(3, 5, 20, 0.75), transparent);
  backdrop-filter: blur(4px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  letter-spacing: 0.14em;
}

.brand-icon {
  color: #becdf0;
}

.nav {
  display: flex;
  align-items: center;
  gap: 12px;
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
  background: linear-gradient(135deg, #becdf0, #6d7fc9);
  color: #151a35;
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

/* ---------------- 主体 ---------------- */

.soul-main {
  position: relative;
  z-index: 1;
  width: min(900px, 100%);
  margin: 0 auto;
  padding: 0 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.hero {
  text-align: center;
  padding: 4vh 16px 6px;
}

.hero h1 {
  margin: 0;
  font-size: clamp(28px, 5.4vw, 42px);
  font-weight: 600;
  letter-spacing: 0.26em;
  text-indent: 0.26em;
  text-shadow: 0 4px 30px rgba(3, 5, 16, 0.7);
  animation: hero-in 1s var(--ease-out) 0.1s backwards;
}

@keyframes hero-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
}

.hero .sub {
  margin: 16px 0 0;
  font-size: clamp(13px, 2vw, 15px);
  letter-spacing: 0.24em;
  text-indent: 0.24em;
  color: var(--ink-dim);
  animation: hero-in 1s var(--ease-out) 0.25s backwards;
}

/* ---------------- 面板通用 ---------------- */

.panel {
  padding: 24px 26px;
  border-radius: 24px;
  animation: hero-in 0.9s var(--ease-out) 0.45s backwards;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-head h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.16em;
}

.panel-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-desc {
  margin: 10px 0 18px;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--ink-dim);
}

.panel-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 30px 10px 24px;
  color: var(--ink-dim);
  font-size: 13.5px;
  letter-spacing: 0.1em;
  text-align: center;
}

.dim-hint p {
  max-width: 460px;
  line-height: 1.8;
  margin: 0;
}

.loader {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid rgba(236, 245, 246, 0.18);
  border-top-color: #becdf0;
  animation: spin 0.9s linear infinite;
}

.gen-badge {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 11.5px;
  letter-spacing: 0.14em;
  color: #dfe6f7;
  background: rgba(190, 205, 240, 0.1);
  border: 1px solid rgba(190, 205, 240, 0.28);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: var(--ink-dim);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  transition:
    background 0.25s ease,
    color 0.25s ease,
    transform 0.25s ease;
}

.icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: var(--ink);
  transform: rotate(40deg);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

/* ---------------- 灵魂画像 ---------------- */

.identity {
  margin: 18px 0 0;
  padding: 18px 22px;
  border-radius: 18px;
  border-left: 3px solid rgba(190, 205, 240, 0.55);
  background: rgba(190, 205, 240, 0.07);
  font-size: 17px;
  line-height: 1.9;
  letter-spacing: 0.05em;
  color: #eef2fc;
}

.chip-groups {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chip-group {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.group-label {
  flex: none;
  width: 44px;
  padding-top: 6px;
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--ink-faint);
}

.group-chips {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.p-chip {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12.5px;
  letter-spacing: 0.05em;
  color: #dfe6f7;
  background: rgba(190, 205, 240, 0.09);
  border: 1px solid rgba(190, 205, 240, 0.22);
  transition:
    background 0.25s ease,
    transform 0.25s ease;
}

.p-chip:hover {
  background: rgba(190, 205, 240, 0.18);
  transform: translateY(-1px);
}

.p-chip.warm {
  color: #efe3c8;
  background: rgba(240, 181, 122, 0.1);
  border-color: rgba(240, 181, 122, 0.28);
}

.p-chip.warm:hover {
  background: rgba(240, 181, 122, 0.18);
}

.tone-line {
  margin: 20px 0 0;
  padding-top: 16px;
  border-top: 1px dashed rgba(190, 205, 240, 0.2);
  font-size: 13.5px;
  letter-spacing: 0.1em;
  color: var(--ink-dim);
}

.profile-foot {
  margin: 10px 0 0;
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--ink-faint);
}

/* ---------------- 匹配 ---------------- */

.match-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.match-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.btn-loader {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(64, 41, 15, 0.25);
  border-top-color: #40290f;
  animation: spin 0.8s linear infinite;
}

.match-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
  margin-top: 4px;
}

.match-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--glass-border);
  animation: card-in 0.6s var(--ease-out) backwards;
  transition:
    border-color 0.3s ease,
    transform 0.3s var(--ease-out),
    box-shadow 0.3s ease;
}

.match-card:hover {
  border-color: rgba(190, 205, 240, 0.4);
  transform: translateY(-3px);
  box-shadow: 0 18px 40px rgba(2, 4, 12, 0.45);
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.97);
  }
}

.match-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.score-ring {
  flex: none;
  width: 72px;
  height: 72px;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: rgba(236, 245, 246, 0.1);
  stroke-width: 5;
}

.ring-fg {
  fill: none;
  stroke-width: 5;
  stroke-linecap: round;
  transition: stroke-dashoffset 1.2s var(--ease-out);
}

.ring-num {
  font-size: 17px;
  font-weight: 700;
  text-anchor: middle;
  transform: rotate(90deg);
  transform-origin: 36px 36px;
  font-family: var(--font-body);
}

.match-agent {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.match-agent b {
  font-size: 19px;
  letter-spacing: 0.12em;
}

.match-preview {
  font-size: 12.5px;
  line-height: 1.7;
  letter-spacing: 0.03em;
  color: var(--ink-dim);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.match-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.collide-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: auto;
}

/* 箭头钉在右侧，让文字在按钮里真正居中 */
.collide-btn svg {
  position: absolute;
  right: 18px;
}

/* ---------------- 历史回响 ---------------- */

.history-sec {
  animation: hero-in 0.9s var(--ease-out) 0.55s backwards;
}

.sec-title {
  margin: 10px 0 16px;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-indent: 0.24em;
  text-align: center;
  color: var(--ink-dim);
}

.history-empty {
  margin: 0;
  padding: 28px 20px;
  text-align: center;
  font-size: 13.5px;
  line-height: 1.9;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  border-radius: 20px;
  overflow: hidden;
}

.history-summary {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  text-align: left;
  transition: background 0.25s ease;
}

.history-summary:hover {
  background: rgba(255, 255, 255, 0.05);
}

.history-agents {
  font-size: 16.5px;
  letter-spacing: 0.12em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-meta {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
}

.score-badge {
  padding: 3px 11px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.history-time {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
  white-space: nowrap;
}

.chev {
  color: var(--ink-faint);
  transition: transform 0.3s var(--ease-out);
}

.chev.open {
  transform: rotate(180deg);
}

.history-detail {
  padding: 4px 20px 18px;
  border-top: 1px solid var(--glass-border);
  animation: detail-in 0.4s var(--ease-out);
}

@keyframes detail-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
}

.history-detail .match-reasons {
  margin-top: 14px;
}

.replay {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.replay-row {
  max-width: 86%;
}

.replay-row.side-b {
  align-self: flex-end;
  text-align: right;
}

.replay-name {
  display: block;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--ink-faint);
  margin-bottom: 4px;
}

.replay-text {
  display: inline-block;
  margin: 0;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13.5px;
  line-height: 1.7;
  text-align: left;
  word-break: break-word;
}

.side-a .replay-text {
  color: #f8ecd4;
  background: rgba(94, 62, 24, 0.32);
  border: 1px solid rgba(240, 181, 122, 0.24);
  border-top-left-radius: 4px;
}

.side-b .replay-text {
  color: #d9f2ec;
  background: rgba(20, 66, 62, 0.34);
  border: 1px solid rgba(127, 212, 201, 0.24);
  border-top-right-radius: 4px;
}

.history-echo {
  margin: 16px 0 0;
  padding: 16px 20px;
  border-radius: 16px;
  border-left: 3px solid rgba(240, 181, 122, 0.6);
  background: rgba(240, 181, 122, 0.07);
  font-size: 14.5px;
  line-height: 2;
  letter-spacing: 0.05em;
  color: #f0e3c8;
  white-space: pre-wrap;
}

.history-actions {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}

.delete-btn {
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
  border: 1px solid transparent;
  transition:
    color 0.25s ease,
    border-color 0.25s ease,
    background 0.25s ease;
}

.delete-btn:hover {
  color: var(--danger);
  border-color: rgba(233, 138, 128, 0.4);
  background: rgba(233, 138, 128, 0.08);
}

.delete-btn.confirming {
  color: var(--danger);
  border-color: rgba(233, 138, 128, 0.55);
  background: rgba(233, 138, 128, 0.12);
}

/* ---------------- 响应式 ---------------- */

@media (max-width: 640px) {
  .topbar {
    padding: 14px 16px;
  }
  .me-name {
    display: none;
  }
  .soul-main {
    padding: 0 14px 60px;
  }
  .panel {
    padding: 20px 18px;
  }
  .panel-head {
    align-items: flex-start;
    gap: 12px;
  }
  .match-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .chip-group {
    flex-direction: column;
    gap: 8px;
  }
  .group-label {
    padding-top: 0;
  }
  .match-grid {
    grid-template-columns: 1fr;
  }
  .history-agents {
    font-size: 14.5px;
  }
  .history-time {
    display: none;
  }
}
</style>
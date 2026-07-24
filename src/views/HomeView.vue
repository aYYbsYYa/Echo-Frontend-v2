<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import OceanBackdrop from "../components/OceanBackdrop.vue";
import SkyBackdrop from "../components/SkyBackdrop.vue";
import BottleIcon from "../components/BottleIcon.vue";
import PlaneIcon from "../components/PlaneIcon.vue";
import ComposeSheet from "../components/ComposeSheet.vue";
import DiscoverStage from "../components/DiscoverStage.vue";
import type { DriftItem } from "../api/types";
import { useIdentity } from "../store/identity";
import { pushToast } from "../store/toast";

const route = useRoute();
const router = useRouter();
const identity = useIdentity();

const mode = computed<"ocean" | "sky">(() => (route.meta.mode === "sky" ? "sky" : "ocean"));
const user = computed(() => identity.state.user);

const composing = ref(false);
const discovering = ref(false);

const hero = computed(() =>
  mode.value === "ocean"
    ? { title: "把心事，交给潮水", sub: "写一张浮笺，或捞起一段陌生人的回声" }
    : { title: "把话语，折进风里", sub: "折一张飞笺，或接住一段轻轻的问候" },
);

const actions = computed(() =>
  mode.value === "ocean"
    ? { cast: "扔一张浮笺", seek: "捞一个上来" }
    : { cast: "折一张飞笺", seek: "接住一张" },
);

function switchMode(next: "ocean" | "sky") {
  if (next === mode.value) return;
  router.push(next === "ocean" ? "/ocean" : "/");
}

function onSent(item: DriftItem) {
  composing.value = false;
  pushToast(
    item.type === "bottle" ? "你的浮笺已入海，愿有人拾起。" : "飞笺已起飞，愿有人接住。",
    "success",
  );
  if (item.reply) {
    window.setTimeout(
      () => pushToast("开发组还塞了一封回信，去「我的」看看吧。", "info", 3600),
      1200,
    );
  }
}
</script>

<template>
  <div class="home">
    <!-- 双场景交叉淡入 -->
    <Transition name="scene">
      <OceanBackdrop v-if="mode === 'ocean'" key="ocean" />
      <SkyBackdrop v-else key="sky" />
    </Transition>

    <!-- 顶栏 -->
    <header class="topbar">
      <div class="brand">
        <BottleIcon v-if="mode === 'ocean'" :size="26" class="brand-icon ocean-icon" />
        <PlaneIcon v-else :size="26" class="brand-icon sky-icon" />
        <span class="serif">Echo · 回响</span>
      </div>

      <nav class="nav">
        <div class="mode-switch">
          <button :class="{ active: mode === 'ocean' }" @click="switchMode('ocean')">海</button>
          <button :class="{ active: mode === 'sky' }" @click="switchMode('sky')">天</button>
          <button @click="router.push('/forest')">森</button>
        </div>
        <button class="me" @click="router.push('/mine')" :aria-label="`查看我的${mode === 'ocean' ? '浮笺' : '飞笺'}`">
          <span class="me-avatar">{{ user?.avatar ?? "匿" }}</span>
          <span class="me-name">{{ user?.nickname }}</span>
        </button>
      </nav>
    </header>

    <!-- 中央文案 -->
    <main class="stage-center">
      <Transition name="hero" mode="out-in">
        <div :key="mode" class="hero">
          <h1 class="serif">{{ hero.title }}</h1>
          <p>{{ hero.sub }}</p>
        </div>
      </Transition>
    </main>

    <!-- 中下部操作坞 -->
    <footer class="dock">
      <button class="btn btn-ghost dock-btn" @click="discovering = true">
        <BottleIcon v-if="mode === 'ocean'" :size="19" />
        <PlaneIcon v-else :size="19" />
        {{ actions.seek }}
      </button>
      <button class="btn btn-primary dock-btn" @click="composing = true">
        {{ actions.cast }}
      </button>
    </footer>

    <!-- 浮层 -->
    <ComposeSheet
      v-if="composing && user"
      :mode="mode"
      :user-id="user.id"
      :nickname="user.nickname"
      :region="user.region"
      @close="composing = false"
      @sent="onSent"
    />
    <DiscoverStage
      v-if="discovering && user"
      :key="mode"
      :mode="mode"
      :user-id="user.id"
      @close="discovering = false"
    />
  </div>
</template>

<style scoped>
.home {
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
  transition: color 0.5s ease;
}

.ocean-icon {
  color: var(--teal);
}

.sky-icon {
  color: #ffd9ae;
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
  background: linear-gradient(135deg, #f7ca92, #eb9f58);
  color: #40290f;
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

/* ---------------- 中央文案 ---------------- */

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
  text-shadow: 0 4px 30px rgba(2, 8, 16, 0.6);
}

.hero p {
  margin: 18px 0 0;
  font-size: clamp(13px, 2vw, 15px);
  letter-spacing: 0.3em;
  text-indent: 0.3em;
  color: var(--ink-dim);
}

.hero-enter-active {
  transition:
    opacity 0.55s var(--ease-out),
    transform 0.55s var(--ease-out);
}
.hero-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.hero-enter-from {
  opacity: 0;
  transform: translateY(16px);
}
.hero-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ---------------- 操作坞 ---------------- */

.dock {
  position: fixed;
  left: 0;
  right: 0;
  top: 68%;
  z-index: 5;
  display: flex;
  justify-content: center;
  gap: 14px;
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
  min-width: 168px;
}

/* ---------------- 场景切换 ---------------- */

.scene-enter-active,
.scene-leave-active {
  transition: opacity 0.9s ease;
}
.scene-enter-from,
.scene-leave-to {
  opacity: 0;
}

@media (max-width: 560px) {
  .topbar {
    padding: 16px 16px;
  }
  .me-name {
    display: none;
  }
  .dock-btn {
    min-width: 0;
    flex: 1;
    max-width: 220px;
  }
  .hero h1 {
    letter-spacing: 0.14em;
  }
}
</style>

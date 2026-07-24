<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api/client";
import type { Capsule, CapsuleMood } from "../api/types";

const props = defineProps<{
  capsule: Capsule;
  userId: string;
}>();

const emit = defineEmits<{
  close: [];
  opened: [capsule: Capsule];
}>();

const phase = ref<"opening" | "reading" | "error">("opening");
const revealed = ref<Capsule | null>(null);
const errorText = ref("");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 8 个萤光从四周汇聚的起点位移（预计算，避免依赖 CSS 三角函数） */
const motes = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * 45 * Math.PI) / 180;
  return {
    x: `${(Math.cos(angle) * 34).toFixed(1)}vw`,
    y: `${(Math.sin(angle) * 22).toFixed(1)}vh`,
    delay: 0.25 + i * 0.09,
  };
});

const moodLabels: Record<CapsuleMood, string> = {
  expect: "期待",
  lost: "迷茫",
  miss: "思念",
  grateful: "感恩",
  resolve: "决心",
  calm: "平静",
};

function writtenDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

onMounted(async () => {
  const animation = new Promise((resolve) => setTimeout(resolve, reducedMotion ? 300 : 3000));
  try {
    const [result] = await Promise.all([api.openCapsule(props.capsule.id, props.userId), animation]);
    revealed.value = result.data;
    phase.value = "reading";
    emit("opened", result.data);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "开启失败，请稍后再试。";
    phase.value = "error";
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="open-overlay">
      <!-- 开启动画 -->
      <div v-if="phase === 'opening'" class="open-stage" aria-hidden="true">
        <span class="beam" />
        <i
          v-for="(mote, n) in motes"
          :key="n"
          class="mote"
          :style="{ '--tx': mote.x, '--ty': mote.y, animationDelay: mote.delay + 's' }"
        />
        <span class="orb" />
        <span class="bloom" />
        <p class="open-caption">时间到了，它想你了。</p>
      </div>

      <!-- 出错 -->
      <div v-else-if="phase === 'error'" class="error-card glass-card">
        <p>{{ errorText }}</p>
        <button class="btn btn-ghost" @click="emit('close')">先回去</button>
      </div>

      <!-- 信件 -->
      <div v-else-if="revealed" class="letter-wrap" @click.self="emit('close')">
        <article class="letter paper-card">
          <header class="letter-head">
            <p class="letter-eyebrow">时光树洞 · 已开启</p>
            <h2 class="serif">{{ revealed.waited_label }}前的你，写给现在的你</h2>
            <div class="letter-badges">
              <span v-if="revealed.mood" class="badge mood">当时的心情：{{ moodLabels[revealed.mood] }}</span>
              <span class="badge">封存了 {{ revealed.waited_label }}</span>
            </div>
          </header>

          <div class="letter-body">
            <p>{{ revealed.content }}</p>
            <img
              v-if="revealed.has_image"
              class="letter-photo"
              :src="api.capsuleImageUrl(revealed.id, userId)"
              alt="随信封存的照片"
            />
          </div>

          <footer class="letter-foot">
            <span>写于 {{ writtenDate(revealed.created_at) }}</span>
            <span class="letter-seal">Echo · 回响</span>
          </footer>

          <button class="btn btn-primary keep-btn" @click="emit('close')">收好这封信</button>
        </article>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.open-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(2, 12, 9, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* ---------------- 开启动画 ---------------- */

.open-stage {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 自顶部落下的光柱 */
.beam {
  position: absolute;
  left: 50%;
  top: -6%;
  width: 200px;
  height: 62%;
  background: linear-gradient(180deg, rgba(238, 233, 196, 0.2), rgba(238, 233, 196, 0.02) 82%, transparent);
  filter: blur(14px);
  transform: translateX(-50%);
  opacity: 0;
  animation: beam-in 1.1s ease 0.2s forwards;
}

@keyframes beam-in {
  to {
    opacity: 1;
  }
}

/* 四面汇聚的萤光 */
.mote {
  position: absolute;
  left: 50%;
  top: 58%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #d8f7a8;
  box-shadow: 0 0 10px 3px rgba(216, 247, 168, 0.6);
  opacity: 0;
  animation: mote-gather 1.5s ease-in 0.25s forwards;
}

@keyframes mote-gather {
  0% {
    opacity: 0;
    transform: translate(var(--tx), var(--ty));
  }
  25% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(0, 0) scale(0.4);
  }
}

/* 升起的时光之种 */
.orb {
  position: absolute;
  left: 50%;
  top: 62%;
  width: 26px;
  height: 26px;
  border-radius: 50% 50% 50% 6px;
  background: radial-gradient(circle at 34% 30%, #fbf3cf, #d9b96a);
  box-shadow:
    0 0 26px 10px rgba(243, 227, 172, 0.5),
    0 0 80px 30px rgba(243, 227, 172, 0.18);
  opacity: 0;
  transform: translate(-50%, 6vh) rotate(45deg) scale(0.5);
  animation: orb-rise 1.3s var(--ease-out) 1.45s forwards;
}

@keyframes orb-rise {
  0% {
    opacity: 0;
    transform: translate(-50%, 6vh) rotate(45deg) scale(0.5);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -12vh) rotate(45deg) scale(1.25);
  }
}

/* 绽放光晕 */
.bloom {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(251, 243, 207, 0.85) 0%, rgba(251, 243, 207, 0) 68%);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.3);
  animation: bloom-out 0.9s ease-out 2.5s forwards;
}

@keyframes bloom-out {
  0% {
    opacity: 0.95;
    transform: translate(-50%, -50%) scale(0.3);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(9);
  }
}

.open-caption {
  position: absolute;
  left: 0;
  right: 0;
  top: 76%;
  margin: 0;
  text-align: center;
  font-size: 14px;
  letter-spacing: 0.3em;
  color: var(--ink-dim);
  opacity: 0;
  animation: caption-in 0.8s ease 0.6s forwards;
}

@keyframes caption-in {
  to {
    opacity: 1;
  }
}

/* ---------------- 出错 ---------------- */

.error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 30px 38px;
  color: var(--ink-dim);
}

/* ---------------- 信件 ---------------- */

.letter-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.letter {
  width: min(560px, 100%);
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  padding: 30px 30px 24px;
  animation: letter-in 0.7s var(--ease-out);
}

@keyframes letter-in {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.94) rotate(-1deg);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.letter-eyebrow {
  margin: 0 0 8px;
  font-size: 11.5px;
  letter-spacing: 0.32em;
  color: var(--paper-dim);
}

.letter-head h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.5;
}

.letter-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.badge {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--paper-ink);
  background: rgba(76, 67, 49, 0.1);
  border: 1px solid rgba(76, 67, 49, 0.16);
}

.badge.mood {
  background: rgba(76, 67, 49, 0.16);
}

.letter-body {
  margin-top: 18px;
  padding: 18px 4px 18px 0;
  border-top: 1px dashed rgba(76, 67, 49, 0.22);
}

.letter-body p {
  margin: 0;
  font-size: 16.5px;
  line-height: 32px;
  color: var(--paper-ink);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 随信封存的照片：拍立得质感 */
.letter-photo {
  display: block;
  max-width: min(320px, 100%);
  margin: 18px auto 4px;
  padding: 8px 8px 26px;
  background: #fffdf6;
  border: 1px solid rgba(76, 67, 49, 0.18);
  box-shadow: 0 10px 26px rgba(76, 67, 49, 0.22);
  transform: rotate(-1.6deg);
  animation: photo-in 0.8s var(--ease-out) 0.25s backwards;
}

@keyframes photo-in {
  from {
    opacity: 0;
    transform: rotate(-1.6deg) translateY(14px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: rotate(-1.6deg);
  }
}

.letter-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12.5px;
  letter-spacing: 0.08em;
  color: var(--paper-dim);
}

.letter-seal {
  padding: 4px 10px;
  border: 1px solid rgba(178, 84, 46, 0.45);
  border-radius: 6px;
  color: #b2542e;
  font-size: 11.5px;
  letter-spacing: 0.14em;
  transform: rotate(-3deg);
}

.keep-btn {
  width: 100%;
  margin-top: 20px;
}

@media (max-width: 560px) {
  .letter {
    padding: 24px 20px 18px;
  }
}
</style>

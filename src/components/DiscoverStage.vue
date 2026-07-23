<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api/client";
import type { DriftItem } from "../api/types";
import { pushToast } from "../store/toast";
import BottleIcon from "./BottleIcon.vue";
import PlaneIcon from "./PlaneIcon.vue";
import LetterCard from "./LetterCard.vue";

const props = defineProps<{
  mode: "ocean" | "sky";
  userId: string;
}>();

const emit = defineEmits<{ close: [] }>();

type Phase = "seeking" | "arriving" | "sealed" | "open" | "empty" | "error";

const phase = ref<Phase>("seeking");
const item = ref<DriftItem | null>(null);
const quietText = ref("");
const likePending = ref(false);
const commentPending = ref(false);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

onMounted(seek);

async function seek() {
  phase.value = "seeking";
  item.value = null;
  try {
    const res =
      props.mode === "ocean" ? await api.discoverBottle(props.userId) : await api.discoverPlane(props.userId);
    if (!res.data) {
      quietText.value = res.message ?? (props.mode === "ocean" ? "海面暂时安静，稍后再来。" : "风里还没有新的飞笺。");
      phase.value = "empty";
      return;
    }
    item.value = res.data;
    phase.value = "arriving";
    window.setTimeout(() => {
      if (phase.value === "arriving") phase.value = "sealed";
    }, reducedMotion ? 200 : 1700);
  } catch (error) {
    quietText.value = error instanceof Error ? error.message : "打捞失败，请再试一次。";
    phase.value = "error";
  }
}

function openLetter() {
  if (phase.value !== "sealed") return;
  phase.value = "open";
}

async function toggleLike() {
  if (!item.value || likePending.value) return;
  likePending.value = true;
  const current = item.value;
  try {
    const res =
      current.type === "bottle"
        ? await api.toggleBottleLike(current.id, props.userId)
        : await api.togglePlaneLike(current.id, props.userId);
    item.value = { ...current, liked: res.data.liked };
  } catch (error) {
    pushToast(error instanceof Error ? error.message : "操作失败。", "error");
  } finally {
    likePending.value = false;
  }
}

async function sendComment(content: string) {
  if (!item.value || commentPending.value) return;
  commentPending.value = true;
  const current = item.value;
  try {
    if (current.type === "bottle") await api.commentBottle(current.id, props.userId, content);
    else await api.commentPlane(current.id, props.userId, content);
    pushToast(current.type === "bottle" ? "悄悄话已塞回瓶里。" : "悄悄话已系上机翼。", "success");
  } catch (error) {
    pushToast(error instanceof Error ? error.message : "留言失败，请再试一次。", "error");
  } finally {
    commentPending.value = false;
  }
}

function onBackdrop() {
  if (phase.value === "open" || phase.value === "empty" || phase.value === "error") emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div class="stage" @click.self="onBackdrop">
      <!-- 打捞中 -->
      <div v-if="phase === 'seeking'" class="center seeking">
        <span class="seek-ring" />
        <span class="seek-ring delay" />
        <BottleIcon v-if="mode === 'ocean'" :size="46" class="seek-icon" />
        <PlaneIcon v-else :size="46" class="seek-icon" />
        <p class="seek-text">{{ mode === "ocean" ? "正在打捞……" : "正在听风……" }}</p>
      </div>

      <!-- 没有收获 / 出错 -->
      <div v-else-if="phase === 'empty' || phase === 'error'" class="center">
        <div class="quiet glass-card">
          <BottleIcon v-if="mode === 'ocean'" :size="44" class="quiet-icon" />
          <PlaneIcon v-else :size="44" class="quiet-icon" />
          <p class="quiet-text serif">{{ quietText }}</p>
          <div class="quiet-actions">
            <button v-if="phase === 'error'" class="btn btn-ghost" @click="seek">再试一次</button>
            <button class="btn btn-primary" @click="emit('close')">
              {{ mode === "ocean" ? "回到海边" : "回到天空" }}
            </button>
          </div>
        </div>
      </div>

      <!-- 到来 / 待拆 -->
      <div
        v-else-if="phase === 'arriving' || phase === 'sealed'"
        class="center arrival"
        :class="{ clickable: phase === 'sealed' }"
        @click="openLetter"
      >
        <template v-if="mode === 'ocean'">
          <span class="surface-ring" :class="{ still: phase === 'sealed' }" />
          <span class="surface-ring r2" :class="{ still: phase === 'sealed' }" />
          <BottleIcon
            :size="76"
            class="arrive-bottle"
            :class="{ rising: phase === 'arriving', bobbing: phase === 'sealed' }"
          />
        </template>
        <template v-else>
          <PlaneIcon
            :size="80"
            class="arrive-plane"
            :class="{ flying: phase === 'arriving', hovering: phase === 'sealed' }"
          />
        </template>
        <p v-if="phase === 'sealed'" class="hint">轻点拆开</p>
      </div>

      <!-- 展开的信 -->
      <div v-else-if="phase === 'open' && item" class="center">
        <LetterCard
          :item="item"
          :like-pending="likePending"
          :comment-pending="commentPending"
          class="unroll"
          @like="toggleLike"
          @comment="sendComment"
          @again="seek"
          @release="emit('close')"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.stage {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(3, 10, 18, 0.42);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

/* ---------------- 打捞中 ---------------- */

.seeking {
  gap: 18px;
}

.seek-icon {
  color: rgba(159, 224, 216, 0.85);
  animation: float-y 3s ease-in-out infinite;
}

.seek-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 90px;
  height: 90px;
  margin: -45px 0 0 -45px;
  border-radius: 50%;
  border: 1.5px solid rgba(159, 224, 216, 0.5);
  animation: seek-pulse 2.2s ease-out infinite;
}

.seek-ring.delay {
  animation-delay: 1.1s;
}

@keyframes seek-pulse {
  0% {
    opacity: 0.8;
    transform: scale(0.5);
  }
  100% {
    opacity: 0;
    transform: scale(2.2);
  }
}

.seek-text {
  margin: 0;
  font-size: 14px;
  letter-spacing: 0.3em;
  color: var(--ink-dim);
}

/* ---------------- 安静 / 出错 ---------------- */

.quiet {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 38px 42px;
  text-align: center;
  animation: sheet-in 0.5s var(--ease-out);
}

@keyframes sheet-in {
  from {
    opacity: 0;
    transform: translateY(26px);
  }
}

.quiet-icon {
  color: rgba(159, 224, 216, 0.6);
}

.quiet-text {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0.1em;
  color: var(--ink);
}

.quiet-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

/* ---------------- 到来 ---------------- */

.arrival {
  pointer-events: none;
}

.arrival.clickable {
  pointer-events: auto;
  cursor: pointer;
}

.arrive-bottle {
  color: #9fe0d8;
  filter: drop-shadow(0 14px 30px rgba(2, 8, 16, 0.55));
}

.arrive-bottle.rising {
  animation: bottle-rise 1.7s var(--ease-out) forwards;
}

@keyframes bottle-rise {
  0% {
    opacity: 0;
    transform: translateY(36vh) scale(0.65) rotate(-16deg);
    filter: blur(6px);
  }
  45% {
    opacity: 1;
    filter: blur(0);
  }
  68% {
    transform: translateY(-2.5vh) scale(1.02) rotate(7deg);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(0deg);
  }
}

.arrive-bottle.bobbing {
  animation: bottle-bob 4.5s ease-in-out infinite;
}

@keyframes bottle-bob {
  0%,
  100% {
    transform: translateY(-7px) rotate(-7deg);
  }
  50% {
    transform: translateY(7px) rotate(6deg);
  }
}

.surface-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 120px;
  height: 34px;
  margin: 34px 0 0 -60px;
  border-radius: 50%;
  border: 1.5px solid rgba(159, 224, 216, 0.4);
  animation: surface 2.6s ease-out infinite;
}

.surface-ring.r2 {
  animation-delay: 1.3s;
}

.surface-ring.still {
  animation-play-state: running;
}

@keyframes surface {
  0% {
    opacity: 0.7;
    transform: scale(0.5);
  }
  100% {
    opacity: 0;
    transform: scale(1.8);
  }
}

.arrive-plane {
  color: #fff3e4;
  filter: drop-shadow(0 14px 30px rgba(16, 8, 24, 0.5));
}

.arrive-plane.flying {
  animation: plane-arrive 1.7s var(--ease-out) forwards;
}

@keyframes plane-arrive {
  0% {
    opacity: 0;
    transform: translate(-64vw, -20vh) rotate(20deg) scale(0.55);
  }
  18% {
    opacity: 1;
  }
  55% {
    transform: translate(9vw, 7vh) rotate(-11deg) scale(1.04);
  }
  78% {
    transform: translate(-3vw, -2vh) rotate(5deg) scale(1);
  }
  100% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg);
  }
}

.arrive-plane.hovering {
  animation: plane-hover 3.6s ease-in-out infinite;
}

@keyframes plane-hover {
  0%,
  100% {
    transform: translateY(-8px) rotate(-4deg);
  }
  50% {
    transform: translateY(8px) rotate(4deg);
  }
}

.hint {
  position: absolute;
  top: calc(50% + 86px);
  margin: 0;
  font-size: 13.5px;
  letter-spacing: 0.4em;
  text-indent: 0.4em;
  color: var(--ink-dim);
  animation: hint-breathe 2.2s ease-in-out infinite;
}

@keyframes hint-breathe {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

/* ---------------- 展开的信 ---------------- */

.unroll {
  animation: unroll 0.6s var(--ease-out);
}

@keyframes unroll {
  0% {
    opacity: 0;
    transform: perspective(900px) rotateX(34deg) translateY(40px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
</style>

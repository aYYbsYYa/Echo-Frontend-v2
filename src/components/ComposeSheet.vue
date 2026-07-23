<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "../api/client";
import type { DriftItem } from "../api/types";
import { pushToast } from "../store/toast";
import BottleIcon from "./BottleIcon.vue";
import PlaneIcon from "./PlaneIcon.vue";

const props = defineProps<{
  mode: "ocean" | "sky";
  userId: string;
  nickname: string;
  region: string;
}>();

const emit = defineEmits<{
  close: [];
  sent: [item: DriftItem];
}>();

const content = ref("");
const image = ref<File | null>(null);
const imagePreview = ref<string | null>(null);
const phase = ref<"edit" | "casting">("edit");
const shaking = ref(false);
const fileInput = ref<HTMLInputElement>();

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const MAX = 500;
const remaining = computed(() => MAX - content.value.length);
const canCast = computed(() => content.value.trim().length > 0 && phase.value === "edit");

const title = computed(() => (props.mode === "ocean" ? "写一张浮笺" : "折一张飞笺"));
const placeholder = computed(() =>
  props.mode === "ocean"
    ? "此刻想说的话，写给未知的有缘人……"
    : "把这句话折进风里，它会落在某个陌生人的窗台……",
);
const castLabel = computed(() => (props.mode === "ocean" ? "封好，投入海中" : "折好，迎风起飞"));

function pickImage() {
  fileInput.value?.click();
}

function onImageChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  (event.target as HTMLInputElement).value = "";
  if (!file) return;
  const okTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!okTypes.includes(file.type)) {
    pushToast("图片仅支持 JPEG、PNG、WebP 或 GIF。", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    pushToast("图片大小不能超过 5MB。", "error");
    return;
  }
  image.value = file;
  imagePreview.value = URL.createObjectURL(file);
}

function removeImage() {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value);
  image.value = null;
  imagePreview.value = null;
}

function cancel() {
  if (phase.value === "casting") return;
  removeImage();
  emit("close");
}

async function cast() {
  const text = content.value.trim();
  if (!text || phase.value !== "edit") return;

  phase.value = "casting";
  const publish =
    props.mode === "ocean"
      ? api.publishBottle(props.userId, text, image.value)
      : api.publishPlane(props.userId, text, image.value);
  const duration = reducedMotion ? 500 : props.mode === "ocean" ? 3400 : 2600;
  const timer = new Promise((resolve) => setTimeout(resolve, duration));

  try {
    const [result] = await Promise.all([publish, timer]);
    removeImage();
    emit("sent", result.data);
  } catch (error) {
    phase.value = "edit";
    shaking.value = true;
    setTimeout(() => (shaking.value = false), 600);
    pushToast(error instanceof Error ? error.message : "发送失败，请再试一次。", "error");
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="sheet-overlay" @click.self="cancel">
      <!-- 书写阶段 -->
      <div v-if="phase === 'edit'" class="composer paper-card" :class="{ shake: shaking }">
        <header class="composer-head">
          <h2 class="serif">{{ title }}</h2>
          <button class="close" aria-label="收起" @click="cancel">×</button>
        </header>

        <textarea
          v-model="content"
          class="composer-input"
          :placeholder="placeholder"
          :maxlength="MAX"
          rows="6"
          autofocus
        />

        <div v-if="imagePreview" class="preview-row">
          <img :src="imagePreview" alt="附带图片预览" />
          <button class="remove-img" aria-label="移除图片" @click="removeImage">×</button>
        </div>

        <p class="signature">—— {{ nickname }} · {{ region || "未标注" }}</p>

        <footer class="composer-foot">
          <button class="attach" aria-label="附带一张图片" @click="pickImage">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="m4.5 17 4.8-4.8a1.5 1.5 0 0 1 2.1 0l6.1 6" />
            </svg>
          </button>
          <span class="counter" :class="{ tight: remaining <= 40 }">{{ remaining }}</span>
          <button class="btn btn-primary cast-btn" :disabled="!canCast" @click="cast">
            {{ castLabel }}
          </button>
        </footer>

        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          @change="onImageChange"
        />
      </div>

      <!-- 投掷阶段：浮笺入海 -->
      <div v-else-if="mode === 'ocean'" class="cast-stage" aria-hidden="true">
        <div class="scroll-paper" />
        <div class="bottle-wrap">
          <BottleIcon :size="72" />
        </div>
        <span class="splash-ripple sr1" />
        <span class="splash-ripple sr2" />
        <span class="splash-ripple sr3" />
        <p class="cast-caption">正在把心事交给潮水……</p>
      </div>

      <!-- 投掷阶段：飞笺起飞 -->
      <div v-else class="cast-stage" aria-hidden="true">
        <div class="fold-paper" />
        <div class="plane-wrap">
          <PlaneIcon :size="76" />
        </div>
        <span class="plane-trail" />
        <p class="cast-caption">正在迎风起飞……</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(3, 10, 18, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* ---------------- 书写卡片 ---------------- */

.composer {
  width: min(560px, 100%);
  padding: 26px 26px 20px;
  animation: sheet-in 0.5s var(--ease-out);
}

@keyframes sheet-in {
  from {
    opacity: 0;
    transform: translateY(34px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.composer.shake {
  animation: shake 0.5s ease;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20%,
  60% {
    transform: translateX(-9px);
  }
  40%,
  80% {
    transform: translateX(9px);
  }
}

.composer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.composer-head h2 {
  margin: 0;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 22px;
  line-height: 1;
  color: var(--paper-dim);
  transition:
    background 0.25s ease,
    transform 0.25s ease;
}

.close:hover {
  background: rgba(76, 67, 49, 0.1);
  transform: rotate(90deg);
}

.composer-input {
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  font-size: 16.5px;
  line-height: 32px;
  color: var(--paper-ink);
  font-family: var(--font-body);
}

.composer-input::placeholder {
  color: rgba(76, 67, 49, 0.36);
}

.preview-row {
  position: relative;
  width: fit-content;
  margin: 10px 0 2px;
}

.preview-row img {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 10px;
  box-shadow: 0 6px 16px rgba(76, 67, 49, 0.25);
}

.remove-img {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #4c4331;
  color: #f8f2e4;
  font-size: 14px;
  line-height: 1;
}

.signature {
  margin: 12px 0 0;
  text-align: right;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--paper-dim);
}

.composer-foot {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed rgba(76, 67, 49, 0.22);
}

.attach {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--paper-dim);
  transition:
    background 0.25s ease,
    color 0.25s ease;
}

.attach:hover {
  background: rgba(76, 67, 49, 0.1);
  color: var(--paper-ink);
}

.counter {
  font-size: 12.5px;
  color: var(--paper-dim);
  font-variant-numeric: tabular-nums;
}

.counter.tight {
  color: #b3552e;
  font-weight: 600;
}

.cast-btn {
  margin-left: auto;
}

/* ---------------- 投掷舞台 ---------------- */

.cast-stage {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cast-caption {
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
  animation: caption-in 0.8s ease 1s forwards;
}

@keyframes caption-in {
  to {
    opacity: 1;
  }
}

/* ---- 信纸卷起 ---- */
.scroll-paper {
  position: absolute;
  left: 50%;
  top: 40%;
  width: 210px;
  height: 132px;
  border-radius: 12px;
  background: linear-gradient(160deg, #fbf5e8, #f0e4cb);
  box-shadow: 0 16px 40px rgba(2, 8, 16, 0.4);
  transform: translate(-50%, -50%);
  animation: roll-up 0.95s var(--ease-out) forwards;
}

@keyframes roll-up {
  0% {
    width: 210px;
    opacity: 1;
    transform: translate(-50%, -50%) rotate(0deg);
  }
  55% {
    width: 30px;
    border-radius: 15px;
    opacity: 1;
  }
  100% {
    width: 24px;
    border-radius: 12px;
    opacity: 0;
    transform: translate(-50%, -50%) rotate(10deg) scale(0.8);
  }
}

/* ---- 瓶：现身 → 落水 → 漂远 ---- */
.bottle-wrap {
  position: absolute;
  left: 50%;
  top: 40%;
  color: #9fe0d8;
  opacity: 0;
  filter: drop-shadow(0 10px 22px rgba(2, 8, 16, 0.5));
  animation: bottle-cast 2.75s ease 0.6s forwards;
}

/* 逐段指定缓动：现身→加速落水→触水回浮，之后全程 linear 随波逐流，
   两段位移/时间成比例（20vw/38%、10vw/18%），速度连续无分段感 */
@keyframes bottle-cast {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5) rotate(0deg);
    animation-timing-function: var(--ease-out);
  }
  9% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
    animation-timing-function: cubic-bezier(0.5, 0.05, 0.8, 0.5);
  }
  32% {
    transform: translate(-50%, 24vh) scale(1) rotate(19deg);
    animation-timing-function: ease-out;
  }
  44% {
    opacity: 1;
    transform: translate(-50%, 20.5vh) scale(0.96) rotate(-9deg);
    animation-timing-function: linear;
  }
  82% {
    opacity: 0.85;
    transform: translate(calc(-50% + 20vw), 21.5vh) scale(0.6) rotate(4deg);
    animation-timing-function: linear;
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + 30vw), 21vh) scale(0.4) rotate(7deg);
  }
}

/* ---- 落水涟漪 ---- */
.splash-ripple {
  position: absolute;
  left: 50%;
  top: calc(40% + 22vh);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(159, 224, 216, 0.75);
  opacity: 0;
  transform: translate(-50%, -50%);
  animation: splash 1.7s ease-out 1.55s forwards;
}

.splash-ripple.sr2 {
  animation-delay: 1.72s;
}

.splash-ripple.sr3 {
  animation-delay: 1.9s;
  border-color: rgba(159, 224, 216, 0.45);
}

@keyframes splash {
  0% {
    opacity: 0.9;
    transform: translate(-50%, -50%) scale(0.4);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(9);
  }
}

/* ---- 信纸折叠 ---- */
.fold-paper {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 210px;
  height: 132px;
  border-radius: 10px;
  background: linear-gradient(160deg, #fbf5e8, #f0e4cb);
  box-shadow: 0 16px 40px rgba(16, 8, 24, 0.4);
  transform: translate(-50%, -50%);
  transform-origin: center bottom;
  animation: fold-up 0.85s var(--ease-out) forwards;
}

@keyframes fold-up {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) perspective(700px) rotateX(0deg) scaleY(1);
  }
  55% {
    opacity: 1;
    transform: translate(-50%, -42%) perspective(700px) rotateX(-58deg) scaleY(0.5);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -38%) perspective(700px) rotateX(-82deg) scale(0.42);
  }
}

/* ---- 飞笺：现身 → 俯冲 → 爬升远去 ---- */
.plane-wrap {
  position: absolute;
  left: 50%;
  top: 42%;
  color: #fff3e4;
  opacity: 0;
  filter: drop-shadow(0 12px 26px rgba(16, 8, 24, 0.45));
  animation: plane-cast 2s cubic-bezier(0.5, 0.05, 0.3, 1) 0.62s forwards;
}

@keyframes plane-cast {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5) rotate(-6deg);
  }
  12% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
  30% {
    transform: translate(calc(-50% - 4vw), 6vh) scale(1) rotate(14deg);
  }
  55% {
    transform: translate(calc(-50% + 9vw), -8vh) scale(0.85) rotate(-10deg);
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + 46vw), -34vh) scale(0.34) rotate(6deg);
    opacity: 0;
  }
}

/* ---- 飞行轨迹 ---- */
.plane-trail {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 34vw;
  max-width: 420px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, rgba(255, 243, 228, 0.65));
  transform-origin: left center;
  transform: rotate(-38deg);
  opacity: 0;
  animation: trail 1.1s ease 1.35s forwards;
}

@keyframes trail {
  0% {
    opacity: 0;
    clip-path: inset(0 100% 0 0);
  }
  35% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    clip-path: inset(0 0 0 0);
  }
}

@media (max-width: 560px) {
  .composer {
    padding: 22px 18px 16px;
  }
  .cast-btn {
    padding: 12px 18px;
    font-size: 14px;
  }
}
</style>

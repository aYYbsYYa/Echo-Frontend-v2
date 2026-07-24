<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "../api/client";
import type { Capsule, CapsuleDuration, CapsuleMood } from "../api/types";
import { pushToast } from "../store/toast";

const props = defineProps<{
  userId: string;
  nickname: string;
}>();

const emit = defineEmits<{
  close: [];
  buried: [capsule: Capsule];
}>();

const content = ref("");
const mood = ref<CapsuleMood | null>(null);
const duration = ref<CapsuleDuration>("month1");
const phase = ref<"edit" | "burying">("edit");
const shaking = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const imagePreview = ref<string | null>(null);
const imageData = ref<string | null>(null);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const MAX = 500;
const remaining = computed(() => MAX - content.value.length);
const canBury = computed(
  () =>
    content.value.trim().length > 0 &&
    phase.value === "edit" &&
    (duration.value !== "custom" || customValid.value),
);

const moods: { key: CapsuleMood; label: string; icon: string }[] = [
  { key: "expect", label: "期待", icon: "✦" },
  { key: "lost", label: "迷茫", icon: "☁" },
  { key: "miss", label: "思念", icon: "❋" },
  { key: "grateful", label: "感恩", icon: "❀" },
  { key: "resolve", label: "决心", icon: "➤" },
  { key: "calm", label: "平静", icon: "≈" },
];

const durations: { key: CapsuleDuration; label: string; hint: string }[] = [
  { key: "minute", label: "1 分钟", hint: "体验完整流程" },
  { key: "month1", label: "1 个月", hint: "一个季节的开头" },
  { key: "month3", label: "3 个月", hint: "换季之后再见" },
  { key: "month6", label: "半年", hint: "足够一些事改变" },
  { key: "month12", label: "一年", hint: "与去年今日重逢" },
  { key: "custom", label: "自定义", hint: "自己定个日子" },
];

const DURATION_DAYS: Record<string, number> = {
  minute: 0,
  month1: 30,
  month3: 91,
  month6: 182,
  month12: 365,
};

/** 自定义时长输入 */
const customDays = ref(7);
const customHours = ref(0);
const customMinutes = ref(0);

const customSeconds = computed(
  () => customDays.value * 86_400 + customHours.value * 3600 + customMinutes.value * 60,
);

const customValid = computed(() => customSeconds.value >= 60);

function clampCustom(field: "days" | "hours" | "minutes", value: number) {
  if (Number.isNaN(value)) value = 0;
  if (field === "days") customDays.value = Math.min(3650, Math.max(0, Math.floor(value)));
  if (field === "hours") customHours.value = Math.min(23, Math.max(0, Math.floor(value)));
  if (field === "minutes") customMinutes.value = Math.min(59, Math.max(0, Math.floor(value)));
}

/** 预计解锁日期的中文提示 */
const unlockHint = computed(() => {
  const now = new Date();
  if (duration.value === "minute") {
    const t = new Date(now.getTime() + 60_000);
    return `约 ${t.getHours()} 时 ${String(t.getMinutes()).padStart(2, "0")} 分解锁`;
  }
  if (duration.value === "custom") {
    if (!customValid.value) return "至少封存 1 分钟，时间才算数";
    const t = new Date(now.getTime() + customSeconds.value * 1000);
    if (customSeconds.value < 86_400) {
      return `约 ${t.getHours()} 时 ${String(t.getMinutes()).padStart(2, "0")} 分解锁`;
    }
    return `将于 ${t.getFullYear()} 年 ${t.getMonth() + 1} 月 ${t.getDate()} 日解锁`;
  }
  const t = new Date(now.getTime() + DURATION_DAYS[duration.value] * 86_400_000);
  return `将于 ${t.getFullYear()} 年 ${t.getMonth() + 1} 月 ${t.getDate()} 日解锁`;
});

function cancel() {
  if (phase.value === "burying") return;
  emit("close");
}

/** 选图 → canvas 压缩（最长边 1280，JPEG 0.82）→ 预览 + data URL */
function onPickImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    pushToast("请选择图片文件。", "error");
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX_SIDE = 1280;
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      if (dataUrl.length > 2_100_000) {
        pushToast("这张图太大了，换一张小一点的吧。", "error");
        input.value = "";
        return;
      }
      imageData.value = dataUrl;
      imagePreview.value = dataUrl;
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => pushToast("图片读取失败，换一张试试。", "error");
    img.src = URL.createObjectURL(file);
  };
  reader.readAsArrayBuffer(file);
  input.value = "";
}

function removeImage() {
  imageData.value = null;
  imagePreview.value = null;
}

async function bury() {
  const text = content.value.trim();
  if (!text || phase.value !== "edit") return;

  phase.value = "burying";
  const publish = api.buryCapsule(
    props.userId,
    text,
    duration.value,
    mood.value,
    duration.value === "custom" ? customSeconds.value : undefined,
    imageData.value ?? undefined,
  );
  const timer = new Promise((resolve) => setTimeout(resolve, reducedMotion ? 500 : 3600));

  try {
    const [result] = await Promise.all([publish, timer]);
    emit("buried", result.data);
  } catch (error) {
    phase.value = "edit";
    shaking.value = true;
    setTimeout(() => (shaking.value = false), 600);
    pushToast(error instanceof Error ? error.message : "埋藏失败，请再试一次。", "error");
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="sheet-overlay" @click.self="cancel">
      <!-- 书写阶段 -->
      <div v-if="phase === 'edit'" class="composer paper-card" :class="{ shake: shaking }">
        <header class="composer-head">
          <h2 class="serif">写一封给未来的信</h2>
          <button class="close" aria-label="收起" @click="cancel">×</button>
        </header>

        <textarea
          v-model="content"
          class="composer-input"
          placeholder="此刻的困惑、期待或秘密，说给未来的自己听……"
          :maxlength="MAX"
          rows="5"
          autofocus
        />

        <!-- 配图预览 -->
        <Transition name="photo">
          <div v-if="imagePreview" class="photo-preview">
            <img :src="imagePreview" alt="随信照片预览" />
            <button class="photo-remove" aria-label="移除照片" @click="removeImage">×</button>
            <span class="photo-note">这张照片会和信一起沉睡</span>
          </div>
        </Transition>

        <!-- 心情标签 -->
        <div class="mood-row">
          <span class="row-label">此刻的心情</span>
          <div class="mood-chips">
            <button
              v-for="m in moods"
              :key="m.key"
              class="mood-chip"
              :class="{ active: mood === m.key }"
              @click="mood = mood === m.key ? null : m.key"
            >
              <i>{{ m.icon }}</i>{{ m.label }}
            </button>
          </div>
        </div>

        <!-- 等待时长 -->
        <div class="duration-row">
          <span class="row-label">封存多久</span>
          <div class="duration-grid">
            <button
              v-for="d in durations"
              :key="d.key"
              class="duration-card"
              :class="{ active: duration === d.key, demo: d.key === 'minute' }"
              @click="duration = d.key"
            >
              <b>{{ d.label }}</b>
              <span>{{ d.hint }}</span>
            </button>
          </div>

          <!-- 自定义时长输入 -->
          <Transition name="custom">
            <div v-if="duration === 'custom'" class="custom-row">
              <label class="custom-field">
                <input
                  type="number" min="0" max="3650" :value="customDays"
                  @input="clampCustom('days', Number(($event.target as HTMLInputElement).value))"
                />
                <span>天</span>
              </label>
              <label class="custom-field">
                <input
                  type="number" min="0" max="23" :value="customHours"
                  @input="clampCustom('hours', Number(($event.target as HTMLInputElement).value))"
                />
                <span>小时</span>
              </label>
              <label class="custom-field">
                <input
                  type="number" min="0" max="59" :value="customMinutes"
                  @input="clampCustom('minutes', Number(($event.target as HTMLInputElement).value))"
                />
                <span>分钟</span>
              </label>
            </div>
          </Transition>

          <p class="unlock-hint">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.6 2.6M9 2.5h6" />
            </svg>
            {{ unlockHint }}，在此之前，谁也打不开——包括你自己。
          </p>
        </div>

        <p class="signature">—— {{ nickname }} · 写于今天</p>

        <footer class="composer-foot">
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            @change="onPickImage"
          />
          <button
            class="photo-btn"
            :class="{ has: !!imagePreview }"
            aria-label="附上一张照片"
            title="附上一张照片"
            @click="fileInput?.click()"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="m5 17 4.5-4.5 3 3L16 12l3 3" />
            </svg>
          </button>
          <span class="counter" :class="{ tight: remaining <= 40 }">{{ remaining }}</span>
          <button class="btn btn-primary bury-btn" :disabled="!canBury" @click="bury">
            封好，埋进时光里
          </button>
        </footer>
      </div>

      <!-- 埋藏阶段：信纸化种入土，破土成苗 -->
      <div v-else class="bury-stage" aria-hidden="true">
        <div class="scroll-paper" />
        <span class="seed" />
        <span class="soil" />
        <svg class="sprout" viewBox="0 0 48 56" width="46" height="54">
          <path class="stem" d="M24 54 C24 40 24 30 24 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
          <path class="leaf leaf-l" d="M24 26 C16 26 10 20 9 12 C18 13 24 18 24 26 Z" fill="currentColor" />
          <path class="leaf leaf-r" d="M24 20 C32 20 38 14 39 6 C30 7 24 12 24 20 Z" fill="currentColor" />
        </svg>
        <span class="glow-ring" />
        <p class="bury-caption">已经埋好了。剩下的，交给时间。</p>
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
  background: rgba(2, 12, 9, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* ---------------- 书写卡片 ---------------- */

.composer {
  width: min(580px, 100%);
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
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
  margin-bottom: 12px;
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

/* ---------------- 配图 ---------------- */

.photo-preview {
  position: relative;
  margin-top: 10px;
  width: fit-content;
  max-width: 100%;
}

.photo-preview img {
  display: block;
  max-width: min(300px, 100%);
  max-height: 180px;
  border-radius: 12px;
  border: 1px solid rgba(76, 67, 49, 0.22);
  box-shadow: 0 8px 22px rgba(76, 67, 49, 0.16);
  object-fit: cover;
}

.photo-remove {
  position: absolute;
  top: -9px;
  right: -9px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #4c4331;
  color: #f8f2e4;
  font-size: 16px;
  line-height: 1;
  box-shadow: 0 4px 10px rgba(76, 67, 49, 0.35);
  transition: transform 0.25s var(--ease-spring);
}

.photo-remove:hover {
  transform: scale(1.12);
}

.photo-note {
  display: block;
  margin-top: 6px;
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--paper-dim);
}

.photo-enter-active {
  transition: opacity 0.35s ease, transform 0.35s var(--ease-out);
}

.photo-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.photo-enter-from,
.photo-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

.photo-btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(76, 67, 49, 0.26);
  color: var(--paper-dim);
  transition:
    color 0.25s ease,
    border-color 0.25s ease,
    background 0.25s ease,
    transform 0.25s var(--ease-spring);
}

.photo-btn:hover {
  transform: translateY(-1px);
  color: var(--paper-ink);
  border-color: rgba(76, 67, 49, 0.5);
}

.photo-btn.has {
  background: #4c4331;
  border-color: #4c4331;
  color: #f8f2e4;
}

/* ---------------- 心情与时长 ---------------- */

.row-label {
  display: block;
  font-size: 12.5px;
  letter-spacing: 0.16em;
  color: var(--paper-dim);
  margin-bottom: 8px;
}

.mood-row {
  margin-top: 12px;
}

.mood-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mood-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 13px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--paper-ink);
  border: 1px solid rgba(76, 67, 49, 0.24);
  transition:
    background 0.25s ease,
    border-color 0.25s ease,
    transform 0.25s var(--ease-spring);
}

.mood-chip i {
  font-style: normal;
  font-size: 12px;
  opacity: 0.75;
}

.mood-chip:hover {
  transform: translateY(-1px);
  border-color: rgba(76, 67, 49, 0.45);
}

.mood-chip.active {
  background: #4c4331;
  border-color: #4c4331;
  color: #f8f2e4;
}

.duration-row {
  margin-top: 16px;
}

.duration-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

/* 自定义时长输入 */
.custom-row {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.custom-field {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(76, 67, 49, 0.24);
  background: rgba(76, 67, 49, 0.05);
  transition: border-color 0.25s ease;
}

.custom-field:focus-within {
  border-color: rgba(76, 67, 49, 0.55);
}

.custom-field input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: var(--paper-ink);
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}

.custom-field input::-webkit-outer-spin-button,
.custom-field input::-webkit-inner-spin-button {
  margin: 0;
}

.custom-field span {
  flex-shrink: 0;
  font-size: 12.5px;
  color: var(--paper-dim);
  letter-spacing: 0.04em;
}

.custom-enter-active {
  transition: opacity 0.35s ease, transform 0.35s var(--ease-out);
}

.custom-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.custom-enter-from,
.custom-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.duration-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 4px;
  border-radius: 12px;
  border: 1px solid rgba(76, 67, 49, 0.24);
  color: var(--paper-ink);
  transition:
    background 0.25s ease,
    border-color 0.25s ease,
    transform 0.25s var(--ease-spring),
    box-shadow 0.25s ease;
}

.duration-card b {
  font-size: 14px;
  letter-spacing: 0.04em;
}

.duration-card span {
  font-size: 10.5px;
  color: var(--paper-dim);
  letter-spacing: 0;
}

.duration-card:hover {
  transform: translateY(-2px);
  border-color: rgba(76, 67, 49, 0.45);
}

.duration-card.active {
  background: #4c4331;
  border-color: #4c4331;
  box-shadow: 0 8px 18px rgba(76, 67, 49, 0.3);
}

.duration-card.active b,
.duration-card.active span {
  color: #f8f2e4;
}

.duration-card.demo:not(.active) {
  border-style: dashed;
}

.unlock-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0 0;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--paper-dim);
}

.unlock-hint svg {
  flex-shrink: 0;
}

.signature {
  margin: 14px 0 0;
  text-align: right;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--paper-dim);
}

.composer-foot {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed rgba(76, 67, 49, 0.22);
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

.bury-btn {
  margin-left: auto;
}

/* ---------------- 埋藏舞台 ---------------- */

.bury-stage {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bury-caption {
  position: absolute;
  left: 0;
  right: 0;
  top: 74%;
  margin: 0;
  text-align: center;
  font-size: 14px;
  letter-spacing: 0.3em;
  color: var(--ink-dim);
  opacity: 0;
  animation: caption-in 0.9s ease 2.5s forwards;
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
  top: 38%;
  width: 210px;
  height: 132px;
  border-radius: 12px;
  background: linear-gradient(160deg, #fbf5e8, #f0e4cb);
  box-shadow: 0 16px 40px rgba(2, 12, 9, 0.45);
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

/* ---- 化作种子落下 ---- */
.seed {
  position: absolute;
  left: 50%;
  top: 38%;
  width: 14px;
  height: 14px;
  border-radius: 50% 50% 50% 4px;
  background: radial-gradient(circle at 34% 30%, #f3e3ac, #c9a45c);
  box-shadow: 0 0 18px 6px rgba(243, 227, 172, 0.45);
  opacity: 0;
  transform: translate(-50%, -50%) rotate(45deg);
  animation: seed-fall 1.15s cubic-bezier(0.55, 0.06, 0.68, 0.4) 0.85s forwards;
}

@keyframes seed-fall {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(45deg) scale(0.5);
  }
  12% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(45deg) scale(1);
  }
  78% {
    opacity: 1;
    transform: translate(-50%, 21vh) rotate(45deg) scale(0.94);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, 23vh) rotate(45deg) scale(0.4);
  }
}

/* ---- 土堆隆起 ---- */
.soil {
  position: absolute;
  left: 50%;
  top: calc(38% + 23.5vh);
  width: 120px;
  height: 26px;
  border-radius: 50%;
  background: radial-gradient(ellipse at 50% 30%, #243318 0%, #101c0c 78%);
  box-shadow: 0 6px 18px rgba(2, 12, 9, 0.6);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.6, 0.4);
  animation: soil-heave 1.3s var(--ease-out) 1.5s forwards;
}

@keyframes soil-heave {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.6, 0.4);
  }
  30% {
    opacity: 1;
  }
  55% {
    transform: translate(-50%, -58%) scale(1.08, 1.15);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1, 1);
  }
}

/* ---- 破土新芽 ---- */
.sprout {
  position: absolute;
  left: 50%;
  top: calc(38% + 23.5vh);
  color: #9ed48a;
  opacity: 0;
  transform: translate(-50%, -96%) scale(0);
  transform-origin: center bottom;
  filter: drop-shadow(0 0 14px rgba(158, 212, 138, 0.5));
  animation: sprout-up 1s var(--ease-spring) 2.3s forwards;
}

.sprout .leaf-l {
  opacity: 0.9;
}

.sprout .leaf-r {
  opacity: 0.75;
}

@keyframes sprout-up {
  0% {
    opacity: 0;
    transform: translate(-50%, -96%) scale(0);
  }
  60% {
    opacity: 1;
    transform: translate(-50%, -96%) scale(1.12);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -96%) scale(1);
  }
}

/* ---- 光晕扩散 ---- */
.glow-ring {
  position: absolute;
  left: 50%;
  top: calc(38% + 23.5vh);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid rgba(216, 247, 168, 0.7);
  opacity: 0;
  transform: translate(-50%, -50%);
  animation: ring-spread 1.6s ease-out 2.4s forwards;
}

@keyframes ring-spread {
  0% {
    opacity: 0.85;
    transform: translate(-50%, -50%) scale(0.4);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(8);
  }
}

@media (max-width: 560px) {
  .composer {
    padding: 22px 18px 16px;
  }
  .duration-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .custom-row {
    flex-wrap: wrap;
  }
  .custom-field {
    flex: 1 1 40%;
  }
  .bury-btn {
    padding: 12px 18px;
    font-size: 14px;
  }
}
</style>

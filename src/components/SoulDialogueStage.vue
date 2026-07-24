<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import SoulBackdrop from "./SoulBackdrop.vue";
import { streamSoulDialogue } from "../api/client";
import type { SoulDialogueMessage, SoulStreamEvent } from "../api/types";

const props = defineProps<{
  userId: string;
  targetUserId?: string;
}>();

const emit = defineEmits<{
  close: [completed: boolean];
  finished: [];
}>();

interface StageMessage extends SoulDialogueMessage {
  shown: string;
  typing: boolean;
}

interface StageMeta {
  agent_a: string;
  agent_b: string;
  score: number;
  reason: string[];
}

const ROUND_LABELS: Record<number, string> = {
  1: "第一轮 · 照面",
  2: "第二轮 · 共鸣",
  3: "第三轮 · 收束",
};

const started = ref(false);
const finished = ref(false);
const failed = ref("");
const meta = ref<StageMeta | null>(null);
const messages = ref<StageMessage[]>([]);
const thinkingFor = ref<string | null>(null);
/** 收到 echo 事件即展开卡片；打字期间 echoTyping 为 true */
const echoVisible = ref(false);
const echoText = ref("");
const echoTyping = ref(false);
const scrollBox = ref<HTMLElement>();

let controller: AbortController | null = null;
let aborted = false;
const queue: SoulStreamEvent[] = [];
let pumping = false;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function scrollStage(behavior: ScrollBehavior = "auto") {
  await nextTick();
  const box = scrollBox.value;
  if (box) box.scrollTo({ top: box.scrollHeight, behavior });
}

function onEvent(event: SoulStreamEvent) {
  if (event.type === "echo") {
    echoVisible.value = true;
    void scrollStage("smooth");
  }
  queue.push(event);
  void pump();
}

/** 事件队列逐条上演：凝思 → 逐字显影 → 停顿，保证节奏不被网络打乱 */
async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length > 0) {
      const event = queue.shift()!;
      if (aborted) return;

      if (event.type === "start") {
        meta.value = event.data;
        started.value = true;
        scrollStage();
        await sleep(600);
      } else if (event.type === "message") {
        thinkingFor.value = event.data.user_id;
        scrollStage();
        await sleep(reducedMotion ? 120 : 760);
        if (aborted) return;
        thinkingFor.value = null;

        const msg = reactive<StageMessage>({ ...event.data, shown: "", typing: true });
        messages.value.push(msg);
        scrollStage();
        for (const ch of event.data.text) {
          if (aborted) return;
          msg.shown += ch;
          if (msg.shown.length % 3 === 0) scrollStage();
          if (!reducedMotion) await sleep(24);
        }
        msg.typing = false;
        await sleep(340);
      } else if (event.type === "echo") {
        // 卡片在事件入队时已经展开；轮到 echo 播放时再开始逐字显影
        await scrollStage("smooth");
        await sleep(reducedMotion ? 150 : 700);
        echoText.value = "";
        echoTyping.value = true;
        for (const ch of event.data.echo) {
          if (aborted) return;
          echoText.value += ch;
          if (echoText.value.length % 2 === 0) await scrollStage();
          if (!reducedMotion) await sleep(38);
        }
        echoTyping.value = false;
        scrollStage();
        // echo 显影完成后，才允许"已收进历史"的提示浮现
        await sleep(250);
        // 若流在 echo 后中断导致 done 丢失，echo 打完即为完成兜底
        if (!finished.value && !failed.value) {
          finished.value = true;
          emit("finished");
        }
      } else if (event.type === "done") {
        // echo 与 done 可能同包到达：等 echo 显影结束再亮"已收进历史"
        while (echoTyping.value && !aborted) {
          await sleep(60);
        }
        if (aborted) return;
        finished.value = true;
        emit("finished");
      } else if (event.type === "error") {
        failed.value = event.data.message || "这次灵魂碰撞意外中断，请重新尝试。";
      }
    }
  } finally {
    pumping = false;
  }
}

function agentName(userId: string): string {
  if (!meta.value) return userId;
  if (userId === props.userId) return meta.value.agent_a;
  return meta.value.agent_b;
}

function isA(userId: string): boolean {
  return userId === props.userId;
}

function showRound(index: number): boolean {
  if (index === 0) return true;
  return messages.value[index - 1].round !== messages.value[index].round;
}

function close() {
  if (!finished.value && !failed.value) {
    aborted = true;
    controller?.abort();
    emit("close", false);
    return;
  }
  emit("close", finished.value);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  if (finished.value || failed.value) close();
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  controller = new AbortController();
  streamSoulDialogue(props.userId, props.targetUserId, onEvent, controller.signal).catch(
    (error) => {
      if (aborted) return;
      // echo 已到达但流被中断（如同包 abort）：echo 打字仍会完成，不判失败
      if (echoVisible.value) return;
      failed.value = error instanceof Error ? error.message : "连接中断，请重新尝试。";
    },
  );
});

onBeforeUnmount(() => {
  aborted = true;
  controller?.abort();
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div class="stage-overlay">
      <SoulBackdrop dim />
      <div class="stage-veil" />

      <div class="stage-shell">
        <!-- 对阵栏 -->
        <header class="duel glass-card">
          <div class="duel-side">
            <span class="duel-orb orb-a" :class="{ live: started }" />
            <div class="duel-name">
              <b class="serif">{{ meta?.agent_a ?? "· · ·" }}</b>
              <i>你的 Soul Agent</i>
            </div>
          </div>

          <div class="duel-center">
            <div class="bridge">
              <!-- 左半光束 + 向左漂来的光点 -->
              <span class="beam left" :class="{ on: started }" />
              <span class="traveler traveler-a" :class="{ on: started }" />
            </div>

            <span v-if="meta" class="duel-score" :class="{ pulsing: started }">
              <b>{{ meta.score }}</b>
              <i>契合</i>
            </span>
            <span v-else class="duel-score waiting">
              <span class="mini-loader" />
            </span>

            <div class="bridge">
              <!-- 右半光束 + 向右漂去的光点 -->
              <span class="beam right" :class="{ on: started }" />
              <span class="traveler traveler-b" :class="{ on: started }" />
            </div>
          </div>

          <div class="duel-side reverse">
            <div class="duel-name right">
              <b class="serif">{{ meta?.agent_b ?? "· · ·" }}</b>
              <i>相遇的 Soul Agent</i>
            </div>
            <span class="duel-orb orb-b" :class="{ live: started }" />
          </div>
        </header>

        <!-- 契合理由 -->
        <Transition name="rise">
          <div v-if="meta && meta.reason.length" class="reason-row">
            <span v-for="r in meta.reason" :key="r" class="reason-chip">{{ r }}</span>
          </div>
        </Transition>

        <!-- 碰撞流 -->
        <div ref="scrollBox" class="stage-flow">
          <div v-if="!started && !failed" class="stage-hint">
            <span class="seek-orb" />
            <p>正在星空中唤醒两位 Soul Agent……</p>
          </div>

          <div v-else-if="failed" class="stage-hint">
            <p class="fail-text">{{ failed }}</p>
            <button class="btn btn-ghost" @click="close">知道了</button>
          </div>

          <template v-else>
            <template v-for="(msg, i) in messages" :key="i">
              <div v-if="showRound(i)" class="round-divider">
                <span class="line" />
                <em>{{ ROUND_LABELS[msg.round] ?? `第 ${msg.round} 轮` }}</em>
                <span class="line" />
              </div>

              <div class="smsg-row" :class="isA(msg.user_id) ? 'side-a' : 'side-b'">
                <span class="smsg-orb" :class="isA(msg.user_id) ? 'orb-a' : 'orb-b'" />
                <div class="smsg-body">
                  <span class="smsg-name">{{ agentName(msg.user_id) }}</span>
                  <p class="smsg-text">
                    {{ msg.shown }}<i v-if="msg.typing" class="caret" />
                  </p>
                </div>
              </div>
            </template>

            <!-- 某方凝思中 -->
            <div v-if="thinkingFor" class="smsg-row" :class="isA(thinkingFor) ? 'side-a' : 'side-b'">
              <span class="smsg-orb thinking" :class="isA(thinkingFor) ? 'orb-a' : 'orb-b'" />
              <div class="smsg-body">
                <span class="smsg-name">{{ agentName(thinkingFor) }}</span>
                <p class="smsg-text thinking-text">
                  <span class="dot" /><span class="dot" /><span class="dot" />
                </p>
              </div>
            </div>

            <!-- 最终回响：收到 echo 事件即展开，随后逐字显影 -->
            <Transition name="echo-in">
              <div v-if="echoVisible" class="echo-card">
                <span class="echo-halo" />
                <p class="echo-label serif">最终回响</p>
                <p v-if="!echoText && echoTyping === false" class="echo-brewing-text">
                  Echo Agent 正在聆听全部表达……
                </p>
                <p v-else class="echo-text serif">{{ echoText }}<i v-if="echoTyping" class="caret light" /></p>
              </div>
            </Transition>
          </template>
        </div>

        <!-- 底栏 -->
        <footer class="stage-foot">
          <template v-if="finished">
            <p class="foot-note success">这段回响已收进「历史回响」。</p>
            <button class="btn btn-primary" @click="close">收起这一幕</button>
          </template>
          <template v-else-if="failed">
            <p class="foot-note">碰撞中断，未被保存。</p>
            <button class="btn btn-ghost" @click="close">收起</button>
          </template>
          <template v-else>
            <p class="foot-note">碰撞进行中 · 提前收起将不会保存</p>
            <button class="btn btn-ghost" @click="close">收起</button>
          </template>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.stage-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  flex-direction: column;
}

.stage-veil {
  position: fixed;
  inset: 0;
  background: rgba(3, 5, 16, 0.55);
  pointer-events: none;
}

.stage-shell {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  width: min(860px, 100%);
  margin: 0 auto;
  padding: 20px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: stage-in 0.5s var(--ease-out);
}

@keyframes stage-in {
  from {
    opacity: 0;
    transform: scale(0.985);
  }
}

/* ---------------- 对阵栏 ---------------- */

.duel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 22px;
  border-radius: 20px;
}

.duel-side {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.duel-orb {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  opacity: 0.35;
  transition:
    opacity 0.8s ease,
    box-shadow 0.8s ease;
}

.duel-orb.live {
  opacity: 1;
  animation: orb-breathe 3.2s ease-in-out infinite;
}

.orb-a {
  background: radial-gradient(circle at 38% 32%, #ffe9c4, #f0b57a 60%, rgba(240, 181, 122, 0.15));
  box-shadow: 0 0 16px 4px rgba(240, 181, 122, 0.4);
}

.orb-b {
  background: radial-gradient(circle at 38% 32%, #cdf3ee, #7fd4c9 60%, rgba(127, 212, 201, 0.15));
  box-shadow: 0 0 16px 4px rgba(127, 212, 201, 0.4);
}

@keyframes orb-breathe {
  0%,
  100% {
    transform: scale(0.92);
  }
  50% {
    transform: scale(1.1);
  }
}

.duel-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.duel-name b {
  font-size: 19px;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.duel-name i {
  font-style: normal;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--ink-faint);
  white-space: nowrap;
}

.duel-name.right {
  text-align: right;
}

.duel-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 0;
}

.bridge {
  position: relative;
  flex: 1;
  max-width: 130px;
  height: 22px;
  display: flex;
  align-items: center;
}

.beam {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1.5px;
  margin-top: -0.75px;
  border-radius: 2px;
  opacity: 0;
  transform: scaleX(0.15);
  transition:
    opacity 0.9s ease,
    transform 1.2s var(--ease-out);
}

.beam.left {
  background: linear-gradient(90deg, rgba(240, 181, 122, 0.75), rgba(240, 181, 122, 0.08));
  transform-origin: left;
}

.beam.right {
  background: linear-gradient(90deg, rgba(127, 212, 201, 0.08), rgba(127, 212, 201, 0.75));
  transform-origin: right;
}

.beam.on {
  opacity: 1;
  transform: scaleX(1);
}

/* 沿光束往中央汇合的光点 */
.traveler {
  position: absolute;
  top: 50%;
  width: 6px;
  height: 6px;
  margin-top: -3px;
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
}

.traveler-a {
  left: 0;
  background: #ffd9a0;
  box-shadow: 0 0 8px 2px rgba(240, 181, 122, 0.75);
}

.traveler-b {
  right: 0;
  background: #a9ece2;
  box-shadow: 0 0 8px 2px rgba(127, 212, 201, 0.75);
}

.traveler.on.traveler-a {
  animation: travel-a 3.6s ease-in-out infinite;
}

.traveler.on.traveler-b {
  animation: travel-b 3.6s ease-in-out infinite;
}

@keyframes travel-a {
  0% {
    left: 0;
    opacity: 0;
  }
  18% {
    opacity: 1;
  }
  62% {
    left: 82%;
    opacity: 1;
  }
  74% {
    left: 90%;
    opacity: 0;
  }
  100% {
    left: 90%;
    opacity: 0;
  }
}

@keyframes travel-b {
  0% {
    right: 0;
    opacity: 0;
  }
  18% {
    opacity: 1;
  }
  62% {
    right: 82%;
    opacity: 1;
  }
  74% {
    right: 90%;
    opacity: 0;
  }
  100% {
    right: 90%;
    opacity: 0;
  }
}

.duel-score {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 62px;
  height: 62px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--glass-border);
  animation: score-pop 0.7s var(--ease-spring);
}

/* 汇合时的"心跳"脉冲 */
.duel-score.pulsing {
  animation:
    score-pop 0.7s var(--ease-spring),
    score-pulse 3.6s ease-in-out 1s infinite;
}

@keyframes score-pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}

@keyframes score-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(240, 181, 122, 0);
  }
  12% {
    box-shadow: 0 0 0 9px rgba(240, 181, 122, 0.1);
  }
  24% {
    box-shadow: 0 0 0 0 rgba(240, 181, 122, 0);
  }
}

.duel-score b {
  font-size: 21px;
  line-height: 1;
  background: linear-gradient(135deg, #f7ca92, #7fd4c9);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.duel-score i {
  font-style: normal;
  font-size: 10.5px;
  letter-spacing: 0.2em;
  color: var(--ink-faint);
  margin-top: 3px;
}

.duel-score.waiting {
  border: none;
  background: transparent;
}

.mini-loader {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid rgba(236, 245, 246, 0.16);
  border-top-color: var(--amber);
  animation: spin 0.9s linear infinite;
}

/* ---------------- 契合理由 ---------------- */

.reason-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.reason-chip {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: #efe3c8;
  background: rgba(240, 181, 122, 0.1);
  border: 1px solid rgba(240, 181, 122, 0.28);
  backdrop-filter: blur(8px);
}

.rise-enter-active {
  transition:
    opacity 0.6s ease 0.2s,
    transform 0.6s var(--ease-out) 0.2s;
}
.rise-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

/* ---------------- 碰撞流 ---------------- */

.stage-flow {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 4px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.stage-flow::-webkit-scrollbar {
  width: 6px;
}

.stage-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--ink-dim);
  font-size: 14px;
  letter-spacing: 0.14em;
}

.fail-text {
  color: var(--danger);
}

.seek-orb {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 34%, #f7e2bd, #eb9f58 58%, rgba(235, 159, 88, 0.1));
  box-shadow: 0 0 24px 8px rgba(235, 159, 88, 0.35);
  animation: seek 1.8s ease-in-out infinite;
}

@keyframes seek {
  0%,
  100% {
    transform: translateY(-6px) scale(0.94);
    opacity: 0.7;
  }
  50% {
    transform: translateY(6px) scale(1.06);
    opacity: 1;
  }
}

.round-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 10px;
}

.round-divider .line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(190, 205, 240, 0.35), transparent);
}

.round-divider em {
  font-style: normal;
  font-size: 11.5px;
  letter-spacing: 0.22em;
  color: rgba(190, 205, 240, 0.8);
  white-space: nowrap;
}

/* 灵魂发言 */
.smsg-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 82%;
  animation: smsg-in 0.45s var(--ease-out);
}

@keyframes smsg-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}

.smsg-row.side-b {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.smsg-orb {
  flex: none;
  width: 22px;
  height: 22px;
  margin-top: 3px;
  border-radius: 50%;
}

.smsg-orb.thinking {
  animation: orb-breathe 1.4s ease-in-out infinite;
}

.smsg-body {
  min-width: 0;
}

.smsg-name {
  display: block;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-faint);
  margin-bottom: 5px;
}

.side-b .smsg-name {
  text-align: right;
}

.smsg-text {
  margin: 0;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14.5px;
  line-height: 1.75;
  letter-spacing: 0.02em;
  word-break: break-word;
}

.side-a .smsg-text {
  color: #f8ecd4;
  background: rgba(94, 62, 24, 0.4);
  border: 1px solid rgba(240, 181, 122, 0.3);
  border-top-left-radius: 5px;
  backdrop-filter: blur(8px);
}

.side-b .smsg-text {
  color: #d9f2ec;
  background: rgba(20, 66, 62, 0.42);
  border: 1px solid rgba(127, 212, 201, 0.3);
  border-top-right-radius: 5px;
  backdrop-filter: blur(8px);
}

.thinking-text {
  display: flex;
  gap: 5px;
  align-items: center;
}

.thinking-text .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.6;
  animation: think-bounce 1.2s ease-in-out infinite;
}

.thinking-text .dot:nth-child(2) {
  animation-delay: 0.15s;
}

.thinking-text .dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes think-bounce {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  50% {
    transform: translateY(-4px);
    opacity: 0.95;
  }
}

.caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.12em;
  background: currentColor;
  animation: caret-blink 0.8s steps(1) infinite;
}

.caret.light {
  background: #ffe9c4;
}

@keyframes caret-blink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

/* ---------------- 最终回响 ---------------- */

.echo-card {
  position: relative;
  align-self: center;
  width: min(560px, 94%);
  margin-top: 10px;
  padding: 26px 30px 24px;
  border-radius: 22px;
  text-align: center;
  background:
    linear-gradient(rgba(40, 26, 10, 0.72), rgba(30, 20, 12, 0.72)) padding-box,
    linear-gradient(140deg, rgba(247, 202, 146, 0.9), rgba(240, 181, 122, 0.25) 45%, rgba(127, 212, 201, 0.7)) border-box;
  border: 1px solid transparent;
  box-shadow:
    0 24px 60px rgba(2, 5, 12, 0.6),
    0 0 44px rgba(240, 181, 122, 0.16);
  overflow: hidden;
}

.echo-in-enter-active {
  transition:
    opacity 0.7s var(--ease-out),
    transform 0.7s var(--ease-out);
}
.echo-in-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.96);
}

.echo-halo {
  position: absolute;
  top: -70px;
  left: 50%;
  width: 260px;
  height: 140px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(247, 202, 146, 0.22), transparent 70%);
  filter: blur(10px);
  pointer-events: none;
}

.echo-label {
  position: relative;
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.4em;
  text-indent: 0.4em;
  color: #f0d8a8;
}

.echo-brewing-text {
  position: relative;
  margin: 16px 0 0;
  font-size: 13px;
  letter-spacing: 0.14em;
  color: var(--ink-faint);
  animation: brewing-breathe 1.6s ease-in-out infinite;
}

@keyframes brewing-breathe {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.echo-text {
  position: relative;
  margin: 16px 0 0;
  font-size: 17px;
  line-height: 2;
  letter-spacing: 0.06em;
  color: #f8ecd4;
  white-space: pre-wrap;
}

/* ---------------- 底栏 ---------------- */

.stage-foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 6px 0 2px;
}

.foot-note {
  margin: 0;
  font-size: 12.5px;
  letter-spacing: 0.12em;
  color: var(--ink-faint);
}

.foot-note.success {
  color: #cdeede;
}

/* ---------------- 响应式 ---------------- */

@media (max-width: 640px) {
  .stage-shell {
    padding: 12px 10px 10px;
  }
  .duel {
    padding: 12px 14px;
  }
  .duel-name b {
    font-size: 15px;
  }
  .duel-name i {
    display: none;
  }
  .duel-score {
    width: 50px;
    height: 50px;
  }
  .smsg-row {
    max-width: 94%;
  }
}
</style>

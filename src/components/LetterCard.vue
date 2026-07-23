<script setup lang="ts">
import { computed, ref } from "vue";
import type { DriftItem, PlaneScene } from "../api/types";
import { timeAgo } from "../utils/time";

const props = defineProps<{
  item: DriftItem;
  likePending?: boolean;
  commentPending?: boolean;
}>();

const emit = defineEmits<{
  like: [];
  comment: [content: string];
  again: [];
  release: [];
}>();

const sceneLabels: Record<PlaneScene, string> = {
  sky: "落在云端",
  window: "停在窗台",
  tree: "挂上树梢",
};

const kindLabel = computed(() =>
  props.item.type === "bottle" ? "漂流瓶" : sceneLabels[(props.item as { scene: PlaneScene }).scene],
);

const commentOpen = ref(false);
const draft = ref("");
const zoomed = ref(false);

function sendComment() {
  const text = draft.value.trim();
  if (!text || props.commentPending) return;
  emit("comment", text);
  draft.value = "";
  commentOpen.value = false;
}
</script>

<template>
  <article class="letter paper-card">
    <header class="letter-head">
      <span class="avatar">{{ item.avatar }}</span>
      <div class="who">
        <b>{{ item.nickname }}</b>
        <span>{{ item.region || "未标注" }} · {{ timeAgo(item.created_at) }}</span>
      </div>
      <span class="kind">{{ kindLabel }}</span>
    </header>

    <p class="letter-content">{{ item.content }}</p>

    <figure v-if="item.image_url" class="letter-figure" @click="zoomed = true">
      <img :src="item.image_url" alt="随信附上的图片" loading="lazy" />
    </figure>

    <footer class="letter-foot">
      <button
        class="action heart-action"
        :class="{ liked: item.liked }"
        :disabled="likePending"
        @click="emit('like')"
      >
        <span class="heart-wrap">
          <svg viewBox="0 0 24 24" width="18" height="18" class="heart-svg">
            <path
              d="M12 20.5c-5.2-3.1-8.5-6.2-8.5-9.9A4.6 4.6 0 0 1 8.1 6c1.6 0 3 .8 3.9 2.1A4.6 4.6 0 0 1 15.9 6a4.6 4.6 0 0 1 4.6 4.6c0 3.7-3.3 6.8-8.5 9.9Z"
              :fill="item.liked ? 'currentColor' : 'none'"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linejoin="round"
            />
          </svg>
          <i v-for="n in 6" :key="n" class="spark" :class="`s${n}`" />
        </span>
        {{ item.liked ? "已留下心意" : "留下心意" }}
      </button>

      <button class="action" @click="commentOpen = !commentOpen">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a8 8 0 0 1-8 8H4l1.6-3.2A8 8 0 1 1 21 12Z" />
        </svg>
        写句悄悄话
      </button>

      <button class="action ghost" @click="emit('again')">
        {{ item.type === "bottle" ? "再捞一个" : "再接一只" }}
      </button>
    </footer>

    <transition name="comment">
      <div v-if="commentOpen" class="comment-box">
        <textarea
          v-model="draft"
          rows="2"
          maxlength="500"
          placeholder="这句话会悄悄送到 TA 手中，别人看不到……"
        />
        <button class="send" :disabled="!draft.trim() || commentPending" @click="sendComment">
          {{ item.type === "bottle" ? "塞回瓶里" : "系上机翼" }}
        </button>
      </div>
    </transition>

    <button class="release" @click="emit('release')">
      {{ item.type === "bottle" ? "放回海里 →" : "让它继续飞 →" }}
    </button>

    <Teleport to="body">
      <div v-if="zoomed" class="lightbox" @click="zoomed = false">
        <img :src="item.image_url!" alt="随信附上的图片" />
      </div>
    </Teleport>
  </article>
</template>

<style scoped>
.letter {
  width: min(560px, 100%);
  max-height: 76vh;
  overflow-y: auto;
  padding: 24px 24px 18px;
}

.letter-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px dashed rgba(76, 67, 49, 0.22);
}

.avatar {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f7ca92, #eb9f58);
  color: #40290f;
  font-weight: 700;
  font-size: 18px;
  flex: none;
}

.who {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.who b {
  font-size: 15.5px;
  letter-spacing: 0.04em;
}

.who span {
  font-size: 12.5px;
  color: var(--paper-dim);
}

.kind {
  margin-left: auto;
  flex: none;
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--paper-dim);
  border: 1px solid rgba(76, 67, 49, 0.25);
  border-radius: 999px;
  padding: 4px 10px;
}

.letter-content {
  margin: 18px 0;
  font-size: 17px;
  line-height: 32px;
  letter-spacing: 0.02em;
  white-space: pre-wrap;
  word-break: break-word;
}

.letter-figure {
  margin: 0 0 16px;
  cursor: zoom-in;
}

.letter-figure img {
  width: 100%;
  max-height: 300px;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(76, 67, 49, 0.22);
}

/* ---------------- 操作区 ---------------- */

.letter-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 14px;
  border-top: 1px dashed rgba(76, 67, 49, 0.22);
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 15px;
  border-radius: 999px;
  font-size: 13.5px;
  letter-spacing: 0.05em;
  color: var(--paper-ink);
  border: 1px solid rgba(76, 67, 49, 0.28);
  transition:
    background 0.25s ease,
    transform 0.25s ease,
    color 0.25s ease;
}

.action:hover {
  background: rgba(76, 67, 49, 0.08);
  transform: translateY(-1px);
}

.action:disabled {
  opacity: 0.5;
}

.action.ghost {
  margin-left: auto;
  border-color: transparent;
  color: var(--paper-dim);
}

.heart-action.liked {
  background: rgba(226, 112, 99, 0.14);
  border-color: rgba(226, 112, 99, 0.5);
  color: #b3452f;
}

.heart-wrap {
  position: relative;
  display: inline-grid;
  place-items: center;
}

.heart-svg {
  display: block;
  transition: transform 0.3s var(--ease-spring);
}

.liked .heart-svg {
  transform: scale(1.15);
}

.spark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #d96a4f;
  opacity: 0;
  pointer-events: none;
}

.liked .spark {
  animation: spark-fly 0.7s ease-out;
}

.s1 { --dx: -14px; --dy: -16px; }
.s2 { --dx: 13px; --dy: -18px; }
.s3 { --dx: -18px; --dy: 0px; animation-delay: 0.05s !important; }
.s4 { --dx: 17px; --dy: 2px; animation-delay: 0.05s !important; }
.s5 { --dx: -8px; --dy: 13px; animation-delay: 0.1s !important; }
.s6 { --dx: 9px; --dy: 14px; animation-delay: 0.1s !important; }

@keyframes spark-fly {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.4);
  }
}

/* ---------------- 留言 ---------------- */

.comment-box {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 14px;
  overflow: hidden;
}

.comment-box textarea {
  flex: 1;
  resize: none;
  border: 1px solid rgba(76, 67, 49, 0.25);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.45);
  padding: 10px 13px;
  font-size: 14px;
  line-height: 22px;
  color: var(--paper-ink);
  outline: none;
}

.comment-box textarea:focus {
  border-color: rgba(226, 154, 82, 0.8);
}

.send {
  flex: none;
  padding: 10px 16px;
  border-radius: 12px;
  background: #4c4331;
  color: #f8f2e4;
  font-size: 13.5px;
  letter-spacing: 0.06em;
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.send:hover:not(:disabled) {
  transform: translateY(-1px);
}

.send:disabled {
  opacity: 0.4;
}

.comment-enter-active,
.comment-leave-active {
  transition: all 0.35s var(--ease-out);
}
.comment-enter-from,
.comment-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.release {
  display: block;
  margin: 16px auto 0;
  font-size: 13px;
  letter-spacing: 0.14em;
  color: var(--paper-dim);
  transition: color 0.25s ease;
}

.release:hover {
  color: var(--paper-ink);
}

/* ---------------- 图片灯箱 ---------------- */

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 5vmin;
  background: rgba(3, 10, 18, 0.86);
  cursor: zoom-out;
  animation: lb-in 0.3s ease;
}

.lightbox img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 12px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
}

@keyframes lb-in {
  from {
    opacity: 0;
  }
}
</style>

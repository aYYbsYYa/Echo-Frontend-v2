<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import MirrorBackdrop from "../components/MirrorBackdrop.vue";
import LanternIcon from "../components/LanternIcon.vue";
import SharedNavigation from "../components/SharedNavigation.vue";
import { api, ApiError } from "../api/client";
import type { EchoConversation, EchoMessage, EchoMode } from "../api/types";
import { useIdentity } from "../store/identity";
import { pushToast } from "../store/toast";
import { timeAgo } from "../utils/time";

const router = useRouter();
const identity = useIdentity();
const user = computed(() => identity.state.user);

/* ---------------- 会话状态 ---------------- */

const conversation = ref<EchoConversation | null>(null);
const mode = ref<EchoMode>("listen");
const booting = ref(true);
const bootError = ref("");
const sending = ref(false);

type ChatEntry =
  | { kind: "message"; message: EchoMessage }
  | { kind: "divider"; id: string; text: string };

const entries = ref<ChatEntry[]>([]);
const scrollBox = ref<HTMLElement>();
const inputRef = ref<HTMLTextAreaElement>();
const draft = ref("");
const recording = ref(false);
const transcribing = ref(false);
let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let audioChunks: Blob[] = [];
let recordingTimer: number | undefined;
const speakingMessageId = ref<string | null>(null);
const speechLoadingId = ref<string | null>(null);
let replyAudio: HTMLAudioElement | null = null;
let replyAudioUrl: string | null = null;

const voiceLabel = computed(() => {
  if (transcribing.value) return "灵笺正在辨认……";
  if (recording.value) return "正在听你说话，点击结束";
  return "按下后说给灵笺听";
});

/** 人格画像提示只弹一次 */
let profileHinted = false;

const modes: { value: EchoMode; label: string; hint: string }[] = [
  { value: "listen", label: "倾听", hint: "灵笺在听。说什么都可以。" },
  { value: "mirror", label: "镜像", hint: "现在，你在和另一个自己对话。" },
];

const modeHint = computed(() => modes.find((m) => m.value === mode.value)?.hint ?? "");

const suggestions = computed(() =>
  mode.value === "listen"
    ? [
        "我最近总是拖延，明明知道该做什么，就是不想动……",
        "我觉得是因为害怕做不好，所以不敢开始",
        "但拖延让我更焦虑了",
      ]
    : ["我该怎么办？", "你觉得我应该从哪里开始？", "为什么我总是在最后一刻才行动？"],
);

const placeholder = computed(() =>
  mode.value === "listen"
    ? "把此刻的心事，慢慢说给灵笺听……"
    : "问一问那个最懂你的人——你自己……",
);

const userMessageCount = computed(
  () =>
    entries.value.filter(
      (e) => e.kind === "message" && e.message.role === "user",
    ).length,
);

/* ---------------- 生命周期 ---------------- */

onMounted(async () => {
  if (!user.value) return;
  try {
    const { data: list } = await api.listEchoConversations(user.value.id);
    const sorted = [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (sorted.length > 0) {
      await openConversation(sorted[0].id, true);
    } else {
      await newChat(true);
    }
  } catch (error) {
    bootError.value = error instanceof Error ? error.message : "灵笺暂时没有醒来，请再试一次。";
  } finally {
    booting.value = false;
  }
});

/* ---------------- 数据操作 ---------------- */

async function newChat(silent = false) {
  if (!user.value) return;
  const { data } = await api.createEchoConversation(user.value.id, mode.value);
  conversation.value = data;
  mode.value = data.mode;
  entries.value = [];
  if (!silent) {
    historyOpen.value = false;
    pushToast("一张新的灵笺铺开了。", "success");
  }
  await nextTick();
  inputRef.value?.focus();
}

async function openConversation(id: string, silent = false) {
  const { data } = await api.getEchoConversation(id);
  conversation.value = data;
  mode.value = data.mode;
  entries.value = withDividers(data.messages ?? []);
  if (!silent) historyOpen.value = false;
  scrollToBottom();
}

/** 按消息所属模式插入分界条，让"何时切换过"一眼可见 */
function withDividers(messages: EchoMessage[]): ChatEntry[] {
  const result: ChatEntry[] = [];
  let lastMode: EchoMode | null = null;
  messages.forEach((message, index) => {
    const current = message.mode ?? null;
    if (current && lastMode && current !== lastMode) {
      result.push({
        kind: "divider",
        id: `divider-${message.id}`,
        text: current === "mirror" ? "从这里开始，镜中的你接过了话" : "从这里开始，回到倾听",
      });
    }
    lastMode = current ?? lastMode;
    result.push({ kind: "message", message });
    void index;
  });
  return result;
}

async function switchMode(next: EchoMode) {
  if (next === mode.value || sending.value) return;
  const previous = mode.value;
  mode.value = next;
  if (!conversation.value) return;
  try {
    const { data } = await api.switchEchoMode(conversation.value.id, next);
    conversation.value = data;
    // 空白灵笺没有上下文：只让空态标题、说明和推荐问题自然切换。
    // 已经发生过对话时，才插入模式分界，帮助用户理解上下文变化。
    if (entries.value.some((entry) => entry.kind === "message")) {
      entries.value = [
        ...entries.value,
        {
          kind: "divider",
          id: `divider-${Date.now()}`,
          text: next === "mirror" ? "镜中的你，睁开了眼睛" : "灵笺回到倾听的位置",
        },
      ];
      scrollToBottom();
    }
  } catch (error) {
    mode.value = previous;
    pushToast(error instanceof Error ? error.message : "切换失败，请再试一次。", "error");
  }
}

async function send(text?: string) {
  const content = (text ?? draft.value).trim();
  if (!content || sending.value || !conversation.value) return;
  sending.value = true;
  if (!text) {
    draft.value = "";
    resizeInput();
  }

  // 乐观上屏：自己的话先落在纸上
  const local: EchoMessage = {
    id: `local-${Date.now()}`,
    conversation_id: conversation.value.id,
    role: "user",
    content,
    timestamp: new Date().toISOString(),
    mode: mode.value,
  };
  entries.value = [...entries.value, { kind: "message", message: local }];
  scrollToBottom();

  try {
    const { data } = await api.sendEchoMessage(conversation.value.id, content);
    entries.value = [
      ...entries.value.filter(
        (e) => !(e.kind === "message" && e.message.id === local.id),
      ),
      { kind: "message", message: data.user_message },
      { kind: "message", message: data.assistant_message },
    ];
    void playReply(data.assistant_message);
    if (!profileHinted && userMessageCount.value >= 5) {
      profileHinted = true;
      window.setTimeout(
        () => pushToast("灵笺已能看清你的轮廓——点右上角「画像」看看。", "success", 3600),
        900,
      );
    }
  } catch (error) {
    entries.value = entries.value.filter(
      (e) => !(e.kind === "message" && e.message.id === local.id),
    );
    draft.value = content;
    pushToast(error instanceof Error ? error.message : "灵笺没有接住这句话，请再说一次。", "error");
  } finally {
    sending.value = false;
    scrollToBottom();
    await nextTick();
    inputRef.value?.focus();
  }
}

function onEnter(event: KeyboardEvent) {
  if (event.shiftKey) return;
  event.preventDefault();
  send();
}

function resizeInput() {
  const el = inputRef.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 132) + "px";
}

function stopReply() {
  replyAudio?.pause();
  if (replyAudio) replyAudio.currentTime = 0;
  replyAudio = null;
  if (replyAudioUrl) URL.revokeObjectURL(replyAudioUrl);
  replyAudioUrl = null;
  speakingMessageId.value = null;
}

async function playReply(message: EchoMessage) {
  if (speakingMessageId.value === message.id) {
    stopReply();
    return;
  }
  stopReply();
  speechLoadingId.value = message.id;
  try {
    const blob = await api.synthesizeSpeech(message.content);
    replyAudioUrl = URL.createObjectURL(blob);
    replyAudio = new Audio(replyAudioUrl);
    speakingMessageId.value = message.id;
    replyAudio.onended = stopReply;
    replyAudio.onerror = () => {
      stopReply();
      pushToast("这段声音暂时无法播放。", "error");
    };
    await replyAudio.play();
  } catch (error) {
    stopReply();
    pushToast(error instanceof Error ? error.message : "灵笺暂时无法开口。", "error");
  } finally {
    speechLoadingId.value = null;
  }
}

function releaseMicrophone() {
  if (recordingTimer !== undefined) window.clearTimeout(recordingTimer);
  recordingTimer = undefined;
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  mediaRecorder = null;
  recording.value = false;
}

async function transcribeRecording(blob: Blob) {
  if (!blob.size) return;
  transcribing.value = true;
  try {
    const extension = blob.type.includes("ogg") ? "ogg" : "webm";
    const { data } = await api.transcribeAudio(blob, `lingjian-recording.${extension}`);
    draft.value = [draft.value.trim(), data.text].filter(Boolean).join("\n");
    await nextTick();
    resizeInput();
    inputRef.value?.focus();
    pushToast("声音已经落成文字，你可以修改后再寄出。", "success");
  } catch (error) {
    pushToast(error instanceof Error ? error.message : "没有听清，请再说一次。", "error");
  } finally {
    transcribing.value = false;
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") return;
  mediaRecorder.stop();
}

async function toggleRecording() {
  if (recording.value) {
    stopRecording();
    return;
  }
  if (transcribing.value || sending.value) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    pushToast("当前浏览器暂不支持录音，请使用最新版浏览器。", "error");
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    const preferredType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "";
    mediaRecorder = preferredType
      ? new MediaRecorder(mediaStream, { mimeType: preferredType })
      : new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size) audioChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      const type = mediaRecorder?.mimeType || audioChunks[0]?.type || "audio/webm";
      const blob = new Blob(audioChunks, { type });
      releaseMicrophone();
      void transcribeRecording(blob);
    };
    mediaRecorder.start();
    recording.value = true;
    recordingTimer = window.setTimeout(stopRecording, 60_000);
  } catch (error) {
    releaseMicrophone();
    const denied = error instanceof DOMException && error.name === "NotAllowedError";
    pushToast(denied ? "需要麦克风权限，才能听见你的声音。" : "麦克风暂时无法使用。", "error");
  }
}

onBeforeUnmount(() => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
  }
  releaseMicrophone();
  stopReply();
});

function scrollToBottom() {
  nextTick(() => {
    const box = scrollBox.value;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  });
}

watch(sending, (value) => {
  if (value) scrollToBottom();
});

/* ---------------- 人格画像浮层 ---------------- */

const profileOpen = ref(false);
const profileLoading = ref(false);
const profileRefreshing = ref(false);
const profile = ref<import("../api/types").EchoProfile | null>(null);
const profileError = ref("");

const PROFILE_TARGET = 5;

/** 画像内核（available 时存在） */
const persona = computed(() => profile.value?.profile_data?.persona ?? null);
const tone = computed(
  () => profile.value?.profile_data?.communication_style?.tone ?? "",
);

const personaGroups = computed(() => {
  const p = persona.value;
  if (!p) return [];
  return [
    { label: "特质", items: p.traits },
    { label: "心绪", items: p.emotion_pattern },
    { label: "热爱", items: p.interests },
    { label: "珍视", items: p.values },
  ].filter((g) => g.items.length > 0);
});

const profileProgress = computed(() =>
  Math.min(1, (profile.value?.message_count ?? 0) / PROFILE_TARGET),
);

async function openProfile() {
  if (!user.value) return;
  profileOpen.value = true;
  profileLoading.value = true;
  profileError.value = "";
  try {
    const { data } = await api.getEchoProfile(user.value.id);
    profile.value = data;
  } catch (error) {
    profileError.value = error instanceof Error ? error.message : "画像暂时没有成形。";
  } finally {
    profileLoading.value = false;
  }
}

async function refreshProfile() {
  if (!user.value || profileRefreshing.value) return;
  profileRefreshing.value = true;
  try {
    const { data } = await api.refreshEchoProfile(user.value.id);
    profile.value = data;
    pushToast("画像已重新落笔。", "success");
  } catch (error) {
    if (error instanceof ApiError) pushToast(error.message, "error");
    else pushToast("重新生成失败，请稍后再试。", "error");
  } finally {
    profileRefreshing.value = false;
  }
}

/* ---------------- 往昔对话抽屉 ---------------- */

const historyOpen = ref(false);
const historyLoading = ref(false);
const historyList = ref<EchoConversation[]>([]);

async function openHistory() {
  if (!user.value) return;
  historyOpen.value = true;
  historyLoading.value = true;
  try {
    const { data } = await api.listEchoConversations(user.value.id);
    historyList.value = [...data].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  } catch (error) {
    pushToast(error instanceof Error ? error.message : "往昔打捞失败。", "error");
  } finally {
    historyLoading.value = false;
  }
}
</script>

<template>
  <div class="echo-page">
    <MirrorBackdrop />

    <!-- 顶栏 -->
    <header class="topbar">
      <div class="brand">
        <LanternIcon :size="26" class="brand-icon" />
        <span class="serif">灵笺 · 见自己</span>
      </div>

      <nav class="nav">
        <SharedNavigation />
        <button class="me" @click="router.push('/mine')" aria-label="查看我的海与风">
          <span class="me-avatar">{{ user?.avatar ?? "匿" }}</span>
          <span class="me-name">{{ user?.nickname }}</span>
        </button>
      </nav>
    </header>

    <!-- 灵笺主舞台 -->
    <main class="chat-shell">
      <!-- 模式与操作 -->
      <div class="chat-head glass-card">
        <div class="segmented mode-segment">
          <span
            class="thumb"
            :style="{ left: mode === 'listen' ? '0%' : '50%', width: '50%' }"
          />
          <button
            v-for="m in modes"
            :key="m.value"
            :class="{ active: mode === m.value }"
            @click="switchMode(m.value)"
          >
            {{ m.label }}
          </button>
        </div>

        <Transition name="hint" mode="out-in">
          <p class="mode-hint" :key="mode">{{ modeHint }}</p>
        </Transition>

        <div class="head-actions">
          <button class="head-btn" @click="newChat()" title="另起一张灵笺">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新笺
          </button>
          <button class="head-btn" @click="openHistory" title="打捞往昔的对话">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
              <path d="M12 7v5l3.5 2" />
            </svg>
            往昔
          </button>
          <button class="head-btn accent" @click="openProfile" title="看看灵笺眼中的你">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8.5" r="3.5" />
              <path d="M5 20c1.4-3.6 4-5.5 7-5.5s5.6 1.9 7 5.5" />
            </svg>
            画像
          </button>
        </div>
      </div>

      <!-- 消息流 -->
      <div ref="scrollBox" class="chat-flow">
        <div v-if="booting" class="flow-hint">
          <span class="loader" />
          <p>灵笺正在展开……</p>
        </div>

        <div v-else-if="bootError" class="flow-hint">
          <p>{{ bootError }}</p>
          <button class="btn btn-ghost" @click="router.go(0)">再试一次</button>
        </div>

        <!-- 空笺：引导语 -->
        <div v-else-if="entries.length === 0" class="empty-letter">
          <LanternIcon :size="64" class="empty-lantern" />
          <Transition name="hint" mode="out-in">
            <h2 class="serif" :key="mode">
              {{ mode === "listen" ? "这一刻，灵笺只听见你" : "镜子里的人，想和你聊聊" }}
            </h2>
          </Transition>
          <p class="empty-sub">
            {{
              mode === "listen"
                ? "不必担心措辞，灵笺会接住每一句话"
                : "它用你的方式思考，替你说出没说出口的话"
            }}
          </p>
          <div class="suggest-row">
            <button
              v-for="(s, i) in suggestions"
              :key="s"
              class="suggest-chip"
              :style="{ animationDelay: 0.14 * i + 0.2 + 's' }"
              @click="send(s)"
            >
              {{ s }}
            </button>
          </div>
        </div>

        <!-- 对话条目 -->
        <TransitionGroup v-else name="msg" tag="div" class="msg-list">
          <template v-for="entry in entries" :key="entry.kind === 'message' ? entry.message.id : entry.id">
            <div v-if="entry.kind === 'divider'" class="mode-divider">
              <span class="line" />
              <em>{{ entry.text }}</em>
              <span class="line" />
            </div>

            <div
              v-else
              class="msg-row"
              :class="[entry.message.role, entry.message.mode === 'mirror' && entry.message.role === 'assistant' ? 'mirrored' : '']"
            >
              <span v-if="entry.message.role === 'assistant'" class="msg-avatar echo-avatar">
                <LanternIcon :size="17" />
              </span>
              <div class="msg-body">
                <p class="msg-text">{{ entry.message.content }}</p>
                <span class="msg-meta">
                  <template v-if="entry.message.role === 'assistant'">
                    {{ entry.message.mode === "mirror" ? "镜中的你" : "灵笺" }} ·
                  </template>
                  {{ timeAgo(entry.message.timestamp) }}
                  <button
                    v-if="entry.message.role === 'assistant'"
                    class="speak-btn"
                    :class="{ active: speakingMessageId === entry.message.id }"
                    :disabled="speechLoadingId === entry.message.id"
                    :aria-label="speakingMessageId === entry.message.id ? '停止朗读' : '朗读这条回复'"
                    :title="speakingMessageId === entry.message.id ? '停止朗读' : '朗读这条回复'"
                    @click="playReply(entry.message)"
                  >
                    <span v-if="speechLoadingId === entry.message.id" class="speak-loader" />
                    <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                      <path v-if="speakingMessageId !== entry.message.id" d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
                      <path v-else d="M16 9v6M20 9v6" />
                    </svg>
                  </button>
                </span>
              </div>
              <span v-if="entry.message.role === 'user'" class="msg-avatar user-avatar">
                {{ user?.nickname?.[0] ?? "我" }}
              </span>
            </div>
          </template>
        </TransitionGroup>

        <!-- 灵笺思索中 -->
        <div v-if="sending" class="msg-row assistant thinking-row">
          <span class="msg-avatar echo-avatar thinking">
            <LanternIcon :size="17" />
          </span>
          <div class="msg-body thinking-bubble">
            <span class="dot" /><span class="dot" /><span class="dot" />
          </div>
        </div>
      </div>

      <!-- 书写坞 -->
      <footer class="write-dock glass-card" :class="{ listening: recording }">
        <button
          class="voice-btn"
          :class="{ recording, transcribing }"
          :disabled="booting || Boolean(bootError) || sending || transcribing"
          :aria-label="voiceLabel"
          :title="voiceLabel"
          @click="toggleRecording"
        >
          <span v-if="recording" class="voice-ripple" />
          <span v-if="transcribing" class="voice-spinner" />
          <svg v-else viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4M8.5 21h7" />
          </svg>
        </button>
        <div class="input-wrap">
          <span v-if="recording" class="input-placeholder voice-active">正在听你说话，再按一次结束……</span>
          <span v-else-if="transcribing" class="input-placeholder voice-active">声音正慢慢落成文字……</span>
          <span v-else-if="!draft" class="input-placeholder">{{ placeholder }}</span>
          <textarea
            ref="inputRef"
            v-model="draft"
            rows="1"
            aria-label="写下想对灵笺说的话"
            :disabled="booting || Boolean(bootError) || recording || transcribing"
            @input="resizeInput"
            @keydown.enter="onEnter"
          />
        </div>
        <button
          class="send-btn"
          :disabled="!draft.trim() || sending"
          aria-label="寄出这句话"
          @click="send()"
        >
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </footer>
    </main>

    <!-- 人格画像浮层 -->
    <Teleport to="body">
      <div v-if="profileOpen" class="sheet-overlay" @click.self="profileOpen = false">
        <div class="profile-sheet paper-card">
          <header class="sheet-head">
            <h2 class="serif">灵笺眼中的你</h2>
            <button class="close" aria-label="收起" @click="profileOpen = false">×</button>
          </header>

          <div v-if="profileLoading" class="sheet-hint">
            <span class="loader dark" />
            <p>灵笺正在提笔……</p>
          </div>

          <div v-else-if="profileError" class="sheet-hint">
            <p>{{ profileError }}</p>
            <button class="btn btn-ghost paper-ghost" @click="openProfile">再试一次</button>
          </div>

          <template v-else-if="profile">
            <!-- 画像未成 -->
            <div v-if="profile.status !== 'available'" class="profile-growing">
              <p class="growing-title serif">轮廓还在雾里</p>
              <p class="growing-sub">
                {{ profile.summary ?? "灵笺还看不清你，再多聊几句。" }}
              </p>
              <div class="progress-track">
                <span class="progress-fill" :style="{ width: profileProgress * 100 + '%' }" />
              </div>
              <p class="growing-count">
                已说过 {{ profile.message_count }} 句 · 约 {{ PROFILE_TARGET }} 句后成形
              </p>
            </div>

            <!-- 画像已成 -->
            <div v-else class="profile-ready">
              <blockquote v-if="persona?.identity" class="identity serif">
                「{{ persona.identity }}」
              </blockquote>

              <div class="chip-groups">
                <div v-for="group in personaGroups" :key="group.label" class="chip-group">
                  <span class="group-label">{{ group.label }}</span>
                  <div class="group-chips">
                    <span
                      v-for="(item, i) in group.items"
                      :key="item"
                      class="p-chip"
                      :style="{ animationDelay: 0.07 * i + 's' }"
                    >
                      {{ item }}
                    </span>
                  </div>
                </div>
              </div>

              <p v-if="tone" class="tone-line">语气 · {{ tone }}</p>
              <p class="profile-foot">由 {{ profile.message_count }} 句表达提炼而来</p>

              <button
                class="btn btn-ghost paper-ghost refresh-btn"
                :disabled="profileRefreshing"
                @click="refreshProfile"
              >
                {{ profileRefreshing ? "正在重新落笔……" : "重新生成画像" }}
              </button>
            </div>
          </template>

          <p class="sheet-foot">画像只来自你与灵笺的对话，只存在于这片湖畔。</p>
        </div>
      </div>
    </Teleport>

    <!-- 往昔对话抽屉 -->
    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="historyOpen" class="drawer-overlay" @click.self="historyOpen = false">
          <aside class="history-drawer">
            <header class="drawer-head">
              <h2 class="serif">往昔的灵笺</h2>
              <button class="drawer-close" aria-label="收起" @click="historyOpen = false">×</button>
            </header>

            <button class="btn btn-primary newchat-btn" @click="newChat()">另起一张新笺</button>

            <div v-if="historyLoading" class="drawer-hint">
              <span class="loader" />
              <p>正在打捞往昔……</p>
            </div>

            <div v-else-if="historyList.length === 0" class="drawer-hint">
              <p>还没有过往的灵笺。</p>
            </div>

            <TransitionGroup v-else name="cards" tag="div" class="history-list">
              <button
                v-for="item in historyList"
                :key="item.id"
                class="history-item"
                :class="{ current: item.id === conversation?.id }"
                @click="openConversation(item.id)"
              >
                <span class="history-badge" :class="item.mode">
                  {{ item.mode === "mirror" ? "镜像" : "倾听" }}
                </span>
                <span class="history-time">
                  落笔于 {{ timeAgo(item.created_at) }} · 动于 {{ timeAgo(item.updated_at) }}
                </span>
                <span v-if="item.id === conversation?.id" class="current-tag">正在展开</span>
              </button>
            </TransitionGroup>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.echo-page {
  position: relative;
  height: 100vh;
  height: 100dvh;
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
  color: #d8bcf0;
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
  background: linear-gradient(135deg, #e3c8f7, #a06cd0);
  color: #2a1240;
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

/* ---------------- 对话壳 ---------------- */

.chat-shell {
  position: relative;
  z-index: 4;
  flex: 1;
  min-height: 0;
  width: min(780px, 100%);
  margin: 0 auto;
  padding: 0 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-radius: 18px;
  animation: head-in 0.7s var(--ease-out) 0.1s backwards;
}

@keyframes head-in {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
}

.mode-segment {
  flex: none;
  width: 172px;
}

.mode-hint {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 13px;
  letter-spacing: 0.1em;
  color: var(--ink-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hint-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}
.hint-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.hint-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.hint-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.head-actions {
  flex: none;
  display: flex;
  gap: 8px;
}

.head-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 13px;
  border-radius: 999px;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--ink-dim);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  transition:
    background 0.25s ease,
    color 0.25s ease,
    transform 0.25s ease;
}

.head-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--ink);
  transform: translateY(-1px);
}

.head-btn.accent {
  color: #f0d8a8;
  border-color: rgba(240, 181, 122, 0.35);
  background: rgba(240, 181, 122, 0.1);
}

.head-btn.accent:hover {
  background: rgba(240, 181, 122, 0.2);
  color: #ffe9c4;
}

/* ---------------- 消息流 ---------------- */

.chat-flow {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 6px 4px;
  scroll-behavior: smooth;
}

.chat-flow::-webkit-scrollbar {
  width: 6px;
}

.flow-hint {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--ink-dim);
  font-size: 14px;
  letter-spacing: 0.12em;
}

.loader {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid rgba(236, 245, 246, 0.18);
  border-top-color: #d8bcf0;
  animation: spin 0.9s linear infinite;
}

.loader.dark {
  border-color: rgba(76, 67, 49, 0.2);
  border-top-color: #8a5fbf;
}

/* 空笺引导 */
.empty-letter {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 18px;
  transform: translateY(-3vh);
}

.empty-lantern {
  color: #e8c9f5;
  filter: drop-shadow(0 0 18px rgba(216, 188, 240, 0.45));
  animation: float-y 5.5s ease-in-out infinite;
}

.empty-letter h2 {
  margin: 22px 0 0;
  font-size: clamp(22px, 4vw, 30px);
  font-weight: 600;
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  text-shadow: 0 4px 26px rgba(7, 4, 20, 0.65);
}

.empty-sub {
  margin: 14px 0 0;
  font-size: 13.5px;
  letter-spacing: 0.22em;
  text-indent: 0.22em;
  color: var(--ink-dim);
}

.suggest-row {
  margin-top: 30px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  max-width: 560px;
}

.suggest-chip {
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--ink-dim);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(8px);
  transition:
    background 0.3s ease,
    color 0.3s ease,
    transform 0.3s var(--ease-spring),
    border-color 0.3s ease;
  animation: chip-in 0.6s var(--ease-out) backwards;
}

@keyframes chip-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}

.suggest-chip:hover {
  background: rgba(216, 188, 240, 0.16);
  border-color: rgba(216, 188, 240, 0.45);
  color: var(--ink);
  transform: translateY(-2px);
}

/* 消息条目 */
.msg-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 6px 2px 10px;
}

.msg-enter-active {
  transition:
    opacity 0.5s var(--ease-out),
    transform 0.5s var(--ease-out);
}
.msg-enter-from {
  opacity: 0;
  transform: translateY(18px);
}
.msg-leave-active {
  transition: opacity 0.2s ease;
}
.msg-leave-to {
  opacity: 0;
}

.mode-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 10px;
}

.mode-divider .line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(216, 188, 240, 0.4), transparent);
}

.mode-divider em {
  font-style: normal;
  font-size: 12px;
  letter-spacing: 0.18em;
  color: rgba(216, 188, 240, 0.75);
  white-space: nowrap;
}

.msg-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  max-width: 88%;
}

.msg-row.user {
  align-self: flex-end;
  flex-direction: row;
  margin-left: auto;
}

.msg-avatar {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
}

.echo-avatar {
  color: #e8c9f5;
  background: radial-gradient(circle at 36% 30%, rgba(216, 188, 240, 0.3), rgba(90, 50, 140, 0.35));
  border: 1px solid rgba(216, 188, 240, 0.4);
  box-shadow: 0 0 14px rgba(216, 188, 240, 0.28);
}

.echo-avatar.thinking {
  animation: avatar-breathe 1.6s ease-in-out infinite;
}

@keyframes avatar-breathe {
  0%,
  100% {
    box-shadow: 0 0 10px rgba(216, 188, 240, 0.2);
  }
  50% {
    box-shadow: 0 0 22px rgba(216, 188, 240, 0.55);
  }
}

.user-avatar {
  font-size: 14px;
  font-weight: 700;
  color: #40290f;
  background: linear-gradient(135deg, #f7ca92, #eb9f58);
  box-shadow: 0 4px 12px rgba(235, 159, 88, 0.35);
}

.msg-body {
  min-width: 0;
}

.msg-text {
  margin: 0;
  padding: 13px 17px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.75;
  letter-spacing: 0.02em;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-row.assistant .msg-text {
  color: #f2eaf9;
  background: rgba(46, 26, 76, 0.62);
  border: 1px solid rgba(216, 188, 240, 0.2);
  border-bottom-left-radius: 6px;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 26px rgba(7, 4, 20, 0.4);
}

/* 镜像模式：渐变描边，像被月光镀了一层 */
.msg-row.mirrored .msg-text {
  background:
    linear-gradient(rgba(52, 28, 86, 0.78), rgba(38, 20, 66, 0.78)) padding-box,
    linear-gradient(135deg, rgba(216, 188, 240, 0.85), rgba(127, 212, 201, 0.55) 52%, rgba(240, 181, 122, 0.75)) border-box;
  border: 1px solid transparent;
  box-shadow:
    0 10px 26px rgba(7, 4, 20, 0.4),
    0 0 24px rgba(160, 108, 208, 0.18);
}

.msg-row.user .msg-text {
  color: #3d2a10;
  background: linear-gradient(150deg, #f8e3bd, #f2cd93);
  border-bottom-right-radius: 6px;
  box-shadow: 0 10px 24px rgba(64, 41, 15, 0.3);
}

.msg-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--ink-faint);
}

.speak-btn {
  width: 25px;
  height: 25px;
  margin-left: 2px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  color: rgba(216, 188, 240, 0.7);
  background: transparent;
  border: 1px solid transparent;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.speak-btn:hover:not(:disabled),
.speak-btn.active {
  color: #f3dcff;
  background: rgba(216, 188, 240, 0.1);
  border-color: rgba(216, 188, 240, 0.2);
}

.speak-btn:disabled {
  cursor: wait;
}

.speak-loader {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid rgba(216, 188, 240, 0.25);
  border-top-color: #e8c9f5;
  animation: spin 0.8s linear infinite;
}

.msg-row.user .msg-meta {
  text-align: right;
}

/* 思索中 */
.thinking-row {
  margin-top: 16px;
}

.thinking-bubble {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 18px;
  border-bottom-left-radius: 6px;
  background: rgba(46, 26, 76, 0.62);
  border: 1px solid rgba(216, 188, 240, 0.2);
  backdrop-filter: blur(10px);
}

.thinking-bubble .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d8bcf0;
  animation: think-bounce 1.3s ease-in-out infinite;
}

.thinking-bubble .dot:nth-child(2) {
  animation-delay: 0.16s;
}

.thinking-bubble .dot:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes think-bounce {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  50% {
    transform: translateY(-5px);
    opacity: 1;
  }
}

/* ---------------- 书写坞 ---------------- */

.write-dock {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 12px 12px 12px 20px;
  border-radius: 22px;
  animation: dock-rise 0.7s var(--ease-out) 0.2s backwards;
}

@keyframes dock-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}

.write-dock.listening {
  border-color: rgba(216, 188, 240, 0.42);
  box-shadow: 0 0 30px rgba(160, 108, 208, 0.16);
}

.voice-btn {
  position: relative;
  flex: none;
  width: 42px;
  height: 42px;
  margin-bottom: 2px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #dbc9eb;
  background: rgba(216, 188, 240, 0.08);
  border: 1px solid rgba(216, 188, 240, 0.24);
  transition: color 0.25s ease, background 0.25s ease, transform 0.25s ease;
}

.voice-btn:hover:not(:disabled) {
  color: #fff0d5;
  background: rgba(216, 188, 240, 0.16);
  transform: translateY(-1px);
}

.voice-btn.recording {
  color: #2a1240;
  background: linear-gradient(135deg, #ead7f7, #c9a0e8);
}

.voice-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.voice-ripple {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  background: #6c378f;
  box-shadow: 0 0 0 0 rgba(216, 188, 240, 0.55);
  animation: voice-pulse 1.4s ease-out infinite;
}

.voice-spinner {
  width: 17px;
  height: 17px;
  border-radius: 50%;
  border: 2px solid rgba(216, 188, 240, 0.25);
  border-top-color: #ead7f7;
  animation: spin 0.8s linear infinite;
}

@keyframes voice-pulse {
  70% { box-shadow: 0 0 0 11px rgba(216, 188, 240, 0); }
  100% { box-shadow: 0 0 0 0 rgba(216, 188, 240, 0); }
}

.input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 46px;
  display: flex;
  align-items: center;
}

.input-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink-faint);
}

.input-placeholder.voice-active {
  color: rgba(232, 201, 245, 0.88);
  letter-spacing: 0.04em;
}

.write-dock textarea {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 46px;
  max-height: 132px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  padding: 10px 0;
  box-sizing: border-box;
  font-size: 15px;
  line-height: 1.7;
  color: var(--ink);
  font-family: var(--font-body);
}

.send-btn {
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #40290f;
  background: linear-gradient(135deg, #f7ca92, #eb9f58);
  box-shadow:
    0 8px 20px rgba(235, 159, 88, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
  transition:
    transform 0.3s var(--ease-spring),
    box-shadow 0.3s ease,
    opacity 0.2s ease;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-2px) rotate(-8deg);
  box-shadow:
    0 14px 28px rgba(235, 159, 88, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.send-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---------------- 画像浮层 ---------------- */

.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(7, 4, 18, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.profile-sheet {
  width: min(520px, 100%);
  max-height: 84vh;
  overflow-y: auto;
  padding: 26px 26px 18px;
  animation: sheet-in 0.5s var(--ease-out);
}

@keyframes sheet-in {
  from {
    opacity: 0;
    transform: translateY(34px) scale(0.96);
  }
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.sheet-head h2 {
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

.sheet-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 34px 0 22px;
  color: var(--paper-dim);
  font-size: 14px;
  letter-spacing: 0.1em;
}

.paper-ghost {
  color: var(--paper-ink);
  border-color: rgba(76, 67, 49, 0.25);
  background: rgba(76, 67, 49, 0.06);
}

.paper-ghost:hover:not(:disabled) {
  background: rgba(76, 67, 49, 0.13);
}

/* 画像未成 */
.profile-growing {
  text-align: center;
  padding: 12px 6px 4px;
}

.growing-title {
  margin: 0;
  font-size: 19px;
  letter-spacing: 0.18em;
  color: var(--paper-ink);
}

.growing-sub {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.8;
  color: var(--paper-dim);
}

.progress-track {
  margin: 22px auto 0;
  width: 100%;
  max-width: 320px;
  height: 8px;
  border-radius: 999px;
  background: rgba(76, 67, 49, 0.12);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #c9a0e8, #eb9f58);
  transition: width 0.8s var(--ease-out);
}

.growing-count {
  margin: 12px 0 6px;
  font-size: 12.5px;
  letter-spacing: 0.12em;
  color: var(--paper-dim);
}

/* 画像已成 */
.profile-ready .identity {
  margin: 4px 0 0;
  padding: 16px 20px;
  border-radius: 16px;
  border-left: 3px solid #b08ad4;
  background: rgba(138, 95, 191, 0.09);
  font-size: 15.5px;
  line-height: 1.9;
  letter-spacing: 0.04em;
  color: var(--paper-ink);
  animation: trait-in 0.5s var(--ease-out) backwards;
}

.chip-groups {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.chip-group {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.group-label {
  flex: none;
  width: 42px;
  padding-top: 6px;
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--paper-dim);
}

.group-chips {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.p-chip {
  padding: 6px 13px;
  border-radius: 999px;
  font-size: 12.5px;
  letter-spacing: 0.04em;
  color: #5b4a7a;
  background: rgba(138, 95, 191, 0.1);
  border: 1px solid rgba(138, 95, 191, 0.22);
  animation: trait-in 0.45s var(--ease-out) backwards;
  transition:
    background 0.25s ease,
    transform 0.25s ease;
}

.p-chip:hover {
  background: rgba(138, 95, 191, 0.2);
  transform: translateY(-1px);
}

.tone-line {
  margin: 18px 0 0;
  padding-top: 14px;
  border-top: 1px dashed rgba(76, 67, 49, 0.22);
  font-size: 13.5px;
  letter-spacing: 0.1em;
  color: var(--paper-dim);
}

.profile-foot {
  margin: 8px 0 0;
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--paper-dim);
}

@keyframes trait-in {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
}

.refresh-btn {
  margin: 18px auto 0;
  display: flex;
}

.sheet-foot {
  margin: 18px 0 0;
  padding-top: 12px;
  border-top: 1px dashed rgba(76, 67, 49, 0.22);
  text-align: center;
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--paper-dim);
}

/* ---------------- 往昔抽屉 ---------------- */

.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(7, 4, 18, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.history-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(380px, 92vw);
  padding: 22px 20px;
  background: rgba(16, 9, 32, 0.9);
  border-left: 1px solid rgba(216, 188, 240, 0.18);
  backdrop-filter: blur(18px);
  overflow-y: auto;
  box-shadow: -30px 0 70px rgba(3, 2, 10, 0.55);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-enter-active .history-drawer {
  transition: transform 0.45s var(--ease-out);
}

.drawer-leave-active .history-drawer {
  transition: transform 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .history-drawer,
.drawer-leave-to .history-drawer {
  transform: translateX(60px);
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-head h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: 0.14em;
}

.drawer-close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 21px;
  color: var(--ink-dim);
  transition:
    background 0.25s ease,
    transform 0.25s ease;
}

.drawer-close:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: rotate(90deg);
}

.newchat-btn {
  width: 100%;
  margin: 18px 0;
}

.drawer-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: var(--ink-dim);
  font-size: 13.5px;
  letter-spacing: 0.1em;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 16px;
  text-align: left;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  transition:
    background 0.25s ease,
    border-color 0.25s ease,
    transform 0.25s ease;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(-3px);
}

.history-item.current {
  border-color: rgba(216, 188, 240, 0.55);
  background: rgba(216, 188, 240, 0.1);
}

.history-badge {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  letter-spacing: 0.14em;
}

.history-badge.listen {
  color: #cdeede;
  background: rgba(127, 212, 201, 0.14);
  border: 1px solid rgba(127, 212, 201, 0.3);
}

.history-badge.mirror {
  color: #ecd6f7;
  background: rgba(201, 160, 232, 0.16);
  border: 1px solid rgba(201, 160, 232, 0.38);
}

.history-time {
  font-size: 12.5px;
  letter-spacing: 0.06em;
  color: var(--ink-dim);
}

.current-tag {
  position: absolute;
  top: 14px;
  right: 16px;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: #d8bcf0;
}

/* ---------------- 响应式 ---------------- */

@media (max-width: 640px) {
  .topbar {
    padding: 14px 16px;
  }
  .me-name {
    display: none;
  }
  .chat-shell {
    padding: 0 12px 12px;
  }
  .chat-head {
    flex-wrap: wrap;
    gap: 10px;
  }
  .mode-hint {
    order: 3;
    width: 100%;
    text-align: center;
  }
  .head-actions {
    margin-left: auto;
  }
  .msg-row {
    max-width: 94%;
  }
}
</style>

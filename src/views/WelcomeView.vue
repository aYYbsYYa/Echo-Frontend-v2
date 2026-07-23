<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import OceanBackdrop from "../components/OceanBackdrop.vue";
import BottleIcon from "../components/BottleIcon.vue";
import { api } from "../api/client";
import { generateUserId } from "../utils/id";
import { useIdentity } from "../store/identity";
import { pushToast } from "../store/toast";

const router = useRouter();
const identity = useIdentity();

const form = reactive({
  nickname: "",
  gender: "prefer_not_to_say",
  region: "",
});

const genders = [
  { value: "male", label: "男生" },
  { value: "female", label: "女生" },
  { value: "prefer_not_to_say", label: "保密" },
];

const submitting = ref(false);
const leaving = ref(false);

const canSubmit = computed(
  () =>
    form.nickname.trim().length >= 1 && form.nickname.trim().length <= 20 && !submitting.value,
);

function thumbStyle(index: number) {
  const width = 100 / genders.length;
  return { left: `${index * width + 0}%`, width: `${width}%` };
}

async function submit() {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    const nickname = form.nickname.trim();
    const region = form.region.trim() || "未标注";
    const id = await generateUserId({ nickname, gender: form.gender, region });
    const { data } = await api.createUser({
      id,
      nickname,
      // 后端契约要求 birthday 必填，但产品侧已不再采集，这里填占位值
      birthday: "2000-01-01",
      gender: form.gender,
      region,
    });
    identity.setUser(data);
    leaving.value = true;
    pushToast(`欢迎你，${data.nickname}。`, "success");
    window.setTimeout(() => router.replace("/"), 650);
  } catch (error) {
    submitting.value = false;
    pushToast(error instanceof Error ? error.message : "创建身份失败，请再试一次。", "error");
  }
}
</script>

<template>
  <div class="welcome" :class="{ leaving }">
    <OceanBackdrop dim />

    <main class="panel glass-card">
      <header class="brand">
        <BottleIcon :size="40" class="brand-icon" />
        <h1 class="serif">Echo · 回响</h1>
        <p>匿名的海，温柔的回声</p>
      </header>

      <form class="form" @submit.prevent="submit">
        <div class="field">
          <label for="nickname">怎么称呼你</label>
          <input
            id="nickname"
            v-model="form.nickname"
            type="text"
            maxlength="20"
            placeholder="1–20 个字符，匿名展示"
            autocomplete="off"
          />
        </div>

        <div class="field">
          <label>性别</label>
          <div class="segmented">
            <span class="thumb" :style="thumbStyle(genders.findIndex((g) => g.value === form.gender))" />
            <button
              v-for="g in genders"
              :key="g.value"
              type="button"
              :class="{ active: form.gender === g.value }"
              @click="form.gender = g.value"
            >
              {{ g.label }}
            </button>
          </div>
        </div>

        <div class="field">
          <label for="region">你所在的地方</label>
          <input
            id="region"
            v-model="form.region"
            type="text"
            maxlength="20"
            placeholder="城市、海边，或「未标注」"
            autocomplete="off"
          />
        </div>

        <button class="btn btn-primary embark" type="submit" :disabled="!canSubmit">
          {{ submitting ? "正在启程……" : "启程，去海边" }}
        </button>

        <p class="note">身份只保存在这台设备上，匿名且无法被他人修改。</p>
      </form>
    </main>
  </div>
</template>

<style scoped>
.welcome {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 32px 18px;
  transition:
    opacity 0.6s ease,
    transform 0.6s ease;
}

.welcome.leaving {
  opacity: 0;
  transform: translateY(18px);
}

.panel {
  position: relative;
  z-index: 1;
  width: min(440px, 100%);
  padding: 36px 32px 28px;
  animation: panel-in 0.7s var(--ease-out);
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.97);
  }
}

.brand {
  text-align: center;
  margin-bottom: 26px;
}

.brand-icon {
  color: var(--teal);
  animation: float-y 4.5s ease-in-out infinite;
}

.brand h1 {
  margin: 12px 0 6px;
  font-size: 30px;
  font-weight: 600;
  letter-spacing: 0.18em;
}

.brand p {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.34em;
  text-indent: 0.34em;
  color: var(--ink-dim);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.embark {
  margin-top: 6px;
  width: 100%;
  padding: 15px;
  font-size: 16px;
}

.note {
  margin: 0;
  text-align: center;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
}
</style>

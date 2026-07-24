<script setup lang="ts">
withDefaults(defineProps<{ dim?: boolean }>(), { dim: false });

/** 一次性生成的随机星野 */
const stars = Array.from({ length: 56 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  top: Math.random() * 52,
  size: 1 + Math.random() * 1.5,
  delay: Math.random() * 6,
  duration: 2.6 + Math.random() * 3.4,
}));

/** 萤火虫：缓慢漂移 + 呼吸闪烁 */
const fireflies = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: 4 + Math.random() * 92,
  top: 30 + Math.random() * 58,
  size: 2.4 + Math.random() * 2.6,
  driftX: (Math.random() - 0.5) * 90,
  driftY: -14 - Math.random() * 42,
  delay: Math.random() * 9,
  duration: 7 + Math.random() * 8,
  glowDuration: 2.2 + Math.random() * 2.8,
}));

/** 远景树篱剪影（松树轮廓） */
const ridgeTrees = Array.from({ length: 17 }, (_, i) => ({
  id: i,
  left: i * 6.1 + Math.random() * 2.4 - 1.5,
  height: 42 + Math.random() * 46,
  width: 30 + Math.random() * 22,
}));
</script>

<template>
  <div class="forest" :class="{ dim }" aria-hidden="true">
    <!-- 夜空 -->
    <div class="sky">
      <i
        v-for="star in stars"
        :key="star.id"
        class="star"
        :style="{
          left: star.left + '%',
          top: star.top + '%',
          width: star.size + 'px',
          height: star.size + 'px',
          animationDelay: star.delay + 's',
          animationDuration: star.duration + 's',
        }"
      />
      <div class="moon" />
      <div class="moon-beam" />
    </div>

    <!-- 远山 -->
    <svg class="ridge ridge-back" viewBox="0 0 1440 180" preserveAspectRatio="none">
      <path d="M0 120 C160 60 300 90 430 116 S660 150 800 108 S1040 40 1180 84 S1360 130 1440 100 L1440 180 L0 180 Z" />
    </svg>

    <!-- 远景树篱 -->
    <div class="treeline">
      <i
        v-for="tree in ridgeTrees"
        :key="tree.id"
        class="pine"
        :style="{
          left: tree.left + '%',
          width: tree.width + 'px',
          height: tree.height + 'px',
        }"
      />
    </div>

    <!-- 近景地面 -->
    <div class="ground">
      <div class="moss-light" />
      <span class="mist mist-a" />
      <span class="mist mist-b" />
    </div>

    <!-- 萤火虫 -->
    <i
      v-for="fly in fireflies"
      :key="fly.id"
      class="firefly"
      :style="{
        left: fly.left + '%',
        top: fly.top + '%',
        width: fly.size + 'px',
        height: fly.size + 'px',
        animationDelay: fly.delay + 's',
        animationDuration: fly.duration + 's',
        '--drift-x': fly.driftX + 'px',
        '--drift-y': fly.driftY + 'px',
      }"
    />

    <div class="vignette" />
    <div v-if="dim" class="dim-veil" />
  </div>
</template>

<style scoped>
.forest {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #04120e;
}

/* ---------- 夜空 ---------- */
.sky {
  position: absolute;
  inset: 0 0 42% 0;
  background: linear-gradient(180deg, #02100c 0%, #06231a 52%, #0b3a2a 100%);
}

.star {
  position: absolute;
  border-radius: 50%;
  background: #e4f4e9;
  animation: twinkle 4.4s ease-in-out infinite;
}

.moon {
  position: absolute;
  top: 8%;
  right: 17%;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 34%, #fdfbe8 0%, #eee9c4 60%, #d9d09e 100%);
  box-shadow:
    0 0 38px 12px rgba(238, 233, 196, 0.2),
    0 0 110px 40px rgba(238, 233, 196, 0.08);
}

/* 透过树冠洒下的月光 */
.moon-beam {
  position: absolute;
  top: 12%;
  right: 8%;
  width: 340px;
  height: 130%;
  background: linear-gradient(
    180deg,
    rgba(238, 233, 196, 0.12) 0%,
    rgba(238, 233, 196, 0.03) 55%,
    transparent 100%
  );
  filter: blur(18px);
  transform: rotate(14deg);
  transform-origin: top center;
  animation: beam-sway 9s ease-in-out infinite;
}

@keyframes beam-sway {
  0%,
  100% {
    opacity: 0.6;
    transform: rotate(12deg);
  }
  50% {
    opacity: 1;
    transform: rotate(16deg);
  }
}

/* ---------- 远山与树篱 ---------- */
.ridge {
  position: absolute;
  left: 0;
  width: 100%;
}

.ridge-back {
  top: 34%;
  height: 26%;
  fill: #0a2c20;
  opacity: 0.85;
}

.treeline {
  position: absolute;
  left: 0;
  right: 0;
  top: 42%;
  height: 120px;
}

.pine {
  position: absolute;
  bottom: 0;
  background: #071f16;
  clip-path: polygon(50% 0%, 68% 26%, 60% 26%, 78% 52%, 68% 52%, 88% 82%, 56% 82%, 56% 100%, 44% 100%, 44% 82%, 12% 82%, 32% 52%, 22% 52%, 40% 26%, 32% 26%);
}

/* ---------- 地面 ---------- */
.ground {
  position: absolute;
  inset: 60% 0 0 0;
  background: linear-gradient(180deg, #0d3828 0%, #082416 30%, #03130b 100%);
}

/* 月光落在草地上的一小片亮 */
.moss-light {
  position: absolute;
  top: 6%;
  right: 10%;
  width: 300px;
  height: 130px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(238, 233, 196, 0.1) 0%, transparent 70%);
  filter: blur(10px);
}

/* 地表雾气 */
.mist {
  position: absolute;
  width: 56vw;
  height: 90px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(190, 226, 205, 0.07) 0%, transparent 70%);
  filter: blur(16px);
}

.mist-a {
  top: 18%;
  left: -8%;
  animation: mist-drift 26s ease-in-out infinite;
}

.mist-b {
  top: 40%;
  right: -12%;
  animation: mist-drift 32s ease-in-out infinite reverse;
}

@keyframes mist-drift {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(9vw);
  }
}

/* ---------- 萤火虫：单动画复合漂移与闪烁 ---------- */
.firefly {
  position: absolute;
  border-radius: 50%;
  background: #d8f7a8;
  box-shadow: 0 0 8px 2px rgba(216, 247, 168, 0.55);
  opacity: 0;
  animation: firefly-wander 12s ease-in-out infinite;
}

@keyframes firefly-wander {
  0%,
  100% {
    transform: translate(0, 0);
    opacity: 0;
  }
  12% {
    opacity: 0.95;
  }
  33% {
    transform: translate(var(--drift-x), var(--drift-y));
    opacity: 0.15;
  }
  55% {
    opacity: 0.75;
  }
  66% {
    transform: translate(calc(var(--drift-x) * -0.4), calc(var(--drift-y) * 0.5));
    opacity: 0.1;
  }
  85% {
    opacity: 0.6;
  }
}

/* ---------- 氛围 ---------- */
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 120% 105% at 50% 44%, transparent 56%, rgba(2, 12, 8, 0.55) 100%);
}

.dim-veil {
  position: absolute;
  inset: 0;
  background: rgba(2, 12, 9, 0.48);
}
</style>

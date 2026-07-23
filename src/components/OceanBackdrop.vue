<script setup lang="ts">
import BottleIcon from "./BottleIcon.vue";

withDefaults(defineProps<{ dim?: boolean }>(), { dim: false });

/** 一次性生成的随机星野 */
const stars = Array.from({ length: 72 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  top: Math.random() * 56,
  size: 1 + Math.random() * 1.6,
  delay: Math.random() * 6,
  duration: 2.4 + Math.random() * 3.2,
}));
</script>

<template>
  <div class="ocean" :class="{ dim }" aria-hidden="true">
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
      <span class="shooting-star" />
      <div class="moon" />
    </div>

    <!-- 海面 -->
    <div class="sea">
      <div class="moon-road" />
      <svg class="wave wave-back" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path
          d="M0 64 C120 34 240 34 360 64 S600 94 720 64 S960 34 1080 64 S1320 94 1440 64 L1440 120 L0 120 Z"
        />
      </svg>
      <svg class="wave wave-mid" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path
          d="M0 70 C140 42 260 42 400 70 S660 98 800 70 S1060 42 1200 70 S1380 96 1440 76 L1440 120 L0 120 Z"
        />
      </svg>
      <svg class="wave wave-front" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path
          d="M0 78 C160 52 300 52 440 78 S720 104 860 78 S1120 52 1240 74 S1380 100 1440 82 L1440 120 L0 120 Z"
        />
      </svg>

      <BottleIcon class="floater floater-a" :size="24" />
      <BottleIcon class="floater floater-b" :size="17" />
    </div>

    <div class="vignette" />
    <div v-if="dim" class="dim-veil" />
  </div>
</template>

<style scoped>
.ocean {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #050f1c;
}

/* ---------- 夜空 ---------- */
.sky {
  position: absolute;
  inset: 0 0 38% 0;
  background: linear-gradient(180deg, #030b18 0%, #071a2c 46%, #0d3247 88%, #11405a 100%);
}

.star {
  position: absolute;
  border-radius: 50%;
  background: #dff2f4;
  animation: twinkle 4s ease-in-out infinite;
}

.moon {
  position: absolute;
  top: 9%;
  right: 15%;
  width: 74px;
  height: 74px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 34%, #fff9e9 0%, #f6e2b2 58%, #e9c88d 100%);
  box-shadow:
    0 0 42px 12px rgba(246, 222, 170, 0.24),
    0 0 120px 44px rgba(246, 222, 170, 0.1);
}

.shooting-star {
  position: absolute;
  top: 16%;
  left: 68%;
  width: 130px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.9), transparent);
  opacity: 0;
  animation: shoot 11s linear infinite;
}

@keyframes shoot {
  0%,
  72% {
    opacity: 0;
    transform: translate(0, 0) rotate(-28deg);
  }
  74% {
    opacity: 1;
  }
  82%,
  100% {
    opacity: 0;
    transform: translate(-34vw, 19vh) rotate(-28deg);
  }
}

/* ---------- 海 ---------- */
.sea {
  position: absolute;
  inset: 62% 0 0 0;
  background: linear-gradient(180deg, #0d3a50 0%, #092a3d 34%, #051624 100%);
}

.moon-road {
  position: absolute;
  top: 0;
  right: 12%;
  width: 130px;
  height: 100%;
  background: linear-gradient(
    180deg,
    rgba(246, 222, 170, 0.22) 0%,
    rgba(246, 222, 170, 0.05) 60%,
    transparent 100%
  );
  filter: blur(14px);
  animation: shimmer 5.5s ease-in-out infinite;
}

@keyframes shimmer {
  0%,
  100% {
    opacity: 0.55;
    transform: scaleX(0.86);
  }
  50% {
    opacity: 1;
    transform: scaleX(1.06);
  }
}

.wave {
  position: absolute;
  left: 0;
  width: 200%;
  height: 64px;
}

.wave path {
  fill: currentColor;
}

.wave-back {
  top: -26px;
  color: #155a76;
  opacity: 0.5;
  animation: drift 15s linear infinite;
}

.wave-mid {
  top: -14px;
  color: #10465f;
  opacity: 0.75;
  animation: drift 10s linear infinite reverse;
}

.wave-front {
  top: -4px;
  color: #0d3a50;
  animation: drift 7.5s linear infinite;
}

@keyframes drift {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

.floater {
  position: absolute;
  color: rgba(150, 214, 207, 0.6);
  animation: bob 6s ease-in-out infinite;
}

.floater-a {
  top: 30%;
  left: 16%;
}

.floater-b {
  top: 52%;
  left: 72%;
  opacity: 0.55;
  animation-delay: -2.6s;
  animation-duration: 7.4s;
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(-5px) rotate(-9deg);
  }
  50% {
    transform: translateY(6px) rotate(7deg);
  }
}

/* ---------- 氛围 ---------- */
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 120% 105% at 50% 42%, transparent 58%, rgba(2, 8, 16, 0.5) 100%);
}

.dim-veil {
  position: absolute;
  inset: 0;
  background: rgba(3, 10, 18, 0.46);
}
</style>

<script setup lang="ts">
withDefaults(defineProps<{ dim?: boolean }>(), { dim: false });

/** 一次性生成的随机星野 */
const stars = Array.from({ length: 66 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  top: Math.random() * 52,
  size: 1 + Math.random() * 1.5,
  delay: Math.random() * 6,
  duration: 2.6 + Math.random() * 3.2,
}));

/** 天灯：自镜湖升起的灵笺，负延迟让首屏就分布在天幕中 */
const lanterns = Array.from({ length: 9 }, (_, i) => ({
  id: i,
  left: 5 + Math.random() * 88,
  scale: 0.62 + Math.random() * 0.62,
  riseDuration: 52 + Math.random() * 30,
  riseDelay: -Math.random() * 72,
  swayDuration: 4.6 + Math.random() * 3.4,
  swayDelay: -Math.random() * 6,
}));
</script>

<template>
  <div class="mirror-scene" :class="{ dim }" aria-hidden="true">
    <!-- 紫夜空 -->
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
      <span class="shooting-star" />
    </div>

    <!-- 远山剪影 -->
    <svg class="ridge" viewBox="0 0 1440 120" preserveAspectRatio="none">
      <path
        d="M0 84 C150 44 260 66 400 78 S620 100 760 72 S1000 30 1140 58 S1330 92 1440 70 L1440 120 L0 120 Z"
      />
    </svg>

    <!-- 镜湖：星空与月的倒影 -->
    <div class="lake">
      <div class="reflection">
        <i
          v-for="star in stars"
          :key="'r' + star.id"
          class="star-reflect"
          :style="{
            left: star.left + '%',
            top: 96 - star.top * 1.7 + '%',
            width: star.size + 'px',
            height: star.size + 'px',
            animationDelay: star.delay + 's',
            animationDuration: star.duration + 's',
          }"
        />
      </div>
      <div class="moon-road" />
      <span class="ripple ripple-a" />
      <span class="ripple ripple-b" />
      <span class="ripple ripple-c" />
      <div class="shore-glow" />
    </div>

    <!-- 升起的天灯灵笺 -->
    <span
      v-for="lantern in lanterns"
      :key="lantern.id"
      class="lantern"
      :style="{
        left: lantern.left + '%',
        animationDuration: lantern.riseDuration + 's',
        animationDelay: lantern.riseDelay + 's',
      }"
    >
      <i
        class="lantern-body"
        :style="{
          transform: `scale(${lantern.scale})`,
          animationDuration: lantern.swayDuration + 's',
          animationDelay: lantern.swayDelay + 's',
        }"
      />
    </span>

    <div class="vignette" />
    <div v-if="dim" class="dim-veil" />
  </div>
</template>

<style scoped>
.mirror-scene {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #07041a;
}

/* ---------- 紫夜空 ---------- */
.sky {
  position: absolute;
  inset: 0 0 40% 0;
  background: linear-gradient(180deg, #07041a 0%, #150b30 52%, #2a1750 88%, #3a2066 100%);
}

.star {
  position: absolute;
  border-radius: 50%;
  background: #e9e2f7;
  animation: twinkle 4.2s ease-in-out infinite;
}

.moon {
  position: absolute;
  top: 12%;
  left: 16%;
  width: 66px;
  height: 66px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 34%, #fdf6ff 0%, #e6d4f2 56%, #c4a8dd 100%);
  box-shadow:
    0 0 40px 12px rgba(216, 188, 240, 0.22),
    0 0 110px 40px rgba(216, 188, 240, 0.09);
}

.shooting-star {
  position: absolute;
  top: 20%;
  left: 62%;
  width: 120px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(240, 230, 255, 0.85), transparent);
  opacity: 0;
  animation: shoot 13s linear infinite;
}

@keyframes shoot {
  0%,
  78% {
    opacity: 0;
    transform: translate(0, 0) rotate(-26deg);
  }
  80% {
    opacity: 1;
  }
  88%,
  100% {
    opacity: 0;
    transform: translate(-30vw, 17vh) rotate(-26deg);
  }
}

/* ---------- 远山 ---------- */
.ridge {
  position: absolute;
  left: 0;
  top: 54%;
  width: 100%;
  height: 8%;
  fill: #1a0f36;
  opacity: 0.9;
}

/* ---------- 镜湖 ---------- */
.lake {
  position: absolute;
  inset: 60% 0 0 0;
  background: linear-gradient(180deg, #33195c 0%, #1d0f3c 30%, #0a0620 100%);
}

.reflection {
  position: absolute;
  inset: 0;
  filter: blur(1.6px);
  opacity: 0.4;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9), transparent 82%);
  -webkit-mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9), transparent 82%);
}

.star-reflect {
  position: absolute;
  border-radius: 50%;
  background: #d9cdef;
  animation: twinkle 4.2s ease-in-out infinite;
}

/* 湖面上的月光路 */
.moon-road {
  position: absolute;
  top: 0;
  left: 13%;
  width: 110px;
  height: 100%;
  background: linear-gradient(
    180deg,
    rgba(226, 204, 246, 0.2) 0%,
    rgba(226, 204, 246, 0.05) 58%,
    transparent 100%
  );
  filter: blur(13px);
  animation: shimmer 6.5s ease-in-out infinite;
}

@keyframes shimmer {
  0%,
  100% {
    opacity: 0.55;
    transform: scaleX(0.88);
  }
  50% {
    opacity: 1;
    transform: scaleX(1.05);
  }
}

/* 湖心偶尔荡开的涟漪 */
.ripple {
  position: absolute;
  left: 50%;
  top: 26%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid rgba(216, 188, 240, 0.4);
  opacity: 0;
  transform: translate(-50%, -50%);
  animation: ripple-spread 9s ease-out infinite;
}

.ripple-b {
  left: 30%;
  top: 40%;
  animation-delay: 3.2s;
}

.ripple-c {
  left: 68%;
  top: 34%;
  animation-delay: 6.1s;
}

@keyframes ripple-spread {
  0% {
    opacity: 0;
    width: 8px;
    height: 8px;
  }
  12% {
    opacity: 0.75;
  }
  62%,
  100% {
    opacity: 0;
    width: 180px;
    height: 46px;
  }
}

/* 岸线处的一线微光 */
.shore-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(216, 188, 240, 0.28) 30%,
    rgba(240, 181, 122, 0.3) 50%,
    rgba(216, 188, 240, 0.28) 70%,
    transparent
  );
  filter: blur(1px);
}

/* ---------- 天灯灵笺 ---------- */
.lantern {
  position: absolute;
  bottom: -70px;
  animation: lantern-rise linear infinite;
  will-change: transform;
}

.lantern-body {
  display: block;
  width: 15px;
  height: 19px;
  border-radius: 46% 46% 38% 38%;
  background: radial-gradient(
    circle at 50% 78%,
    #ffe9bb 0%,
    #f7c877 42%,
    rgba(247, 200, 119, 0.4) 78%,
    rgba(247, 200, 119, 0.1) 100%
  );
  box-shadow:
    0 0 14px 4px rgba(247, 200, 119, 0.5),
    0 0 34px 10px rgba(247, 200, 119, 0.16);
  animation: lantern-sway ease-in-out infinite alternate;
  transform-origin: center;
}

@keyframes lantern-rise {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-118vh);
  }
}

@keyframes lantern-sway {
  0% {
    margin-left: -13px;
    opacity: 0.75;
  }
  50% {
    opacity: 1;
  }
  100% {
    margin-left: 13px;
    opacity: 0.8;
  }
}

/* ---------- 氛围 ---------- */
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 120% 105% at 50% 44%,
    transparent 56%,
    rgba(7, 4, 20, 0.52) 100%
  );
}

.dim-veil {
  position: absolute;
  inset: 0;
  background: rgba(7, 4, 18, 0.46);
}
</style>

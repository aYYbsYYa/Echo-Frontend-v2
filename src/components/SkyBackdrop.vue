<script setup lang="ts">
import PlaneIcon from "./PlaneIcon.vue";

withDefaults(defineProps<{ dim?: boolean }>(), { dim: false });

const stars = Array.from({ length: 46 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  top: Math.random() * 40,
  size: 1 + Math.random() * 1.5,
  delay: Math.random() * 6,
  duration: 2.6 + Math.random() * 3,
}));

const clouds = [
  { id: 1, top: 14, left: 6, width: 300, opacity: 0.16, duration: 26 },
  { id: 2, top: 26, left: 58, width: 380, opacity: 0.12, duration: 34 },
  { id: 3, top: 44, left: 24, width: 340, opacity: 0.1, duration: 30 },
  { id: 4, top: 8, left: 72, width: 240, opacity: 0.14, duration: 22 },
];
</script>

<template>
  <div class="dusk" :class="{ dim }" aria-hidden="true">
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

    <div class="low-sun" />

    <div
      v-for="cloud in clouds"
      :key="cloud.id"
      class="cloud"
      :style="{
        top: cloud.top + '%',
        left: cloud.left + '%',
        width: cloud.width + 'px',
        opacity: cloud.opacity,
        animationDuration: cloud.duration + 's',
      }"
    />

    <PlaneIcon class="glider glider-a" :size="20" />
    <PlaneIcon class="glider glider-b" :size="14" />

    <div class="cloud-sea" />
    <div class="vignette" />
    <div v-if="dim" class="dim-veil" />
  </div>
</template>

<style scoped>
.dusk {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    #121a3e 0%,
    #2c2458 30%,
    #5c3a63 56%,
    #a35e60 78%,
    #d68a63 100%
  );
}

.star {
  position: absolute;
  border-radius: 50%;
  background: #f3eefc;
  animation: twinkle 4s ease-in-out infinite;
}

.low-sun {
  position: absolute;
  left: 50%;
  bottom: 12%;
  width: 340px;
  height: 340px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 190, 130, 0.5) 0%, rgba(255, 170, 110, 0.12) 46%, transparent 70%);
  filter: blur(6px);
}

.cloud {
  position: absolute;
  height: 84px;
  border-radius: 999px;
  background: rgba(255, 224, 205, 0.9);
  filter: blur(26px);
  animation: cloud-drift ease-in-out infinite alternate;
}

@keyframes cloud-drift {
  from {
    transform: translateX(-5vw);
  }
  to {
    transform: translateX(6vw);
  }
}

.glider {
  position: absolute;
  color: rgba(255, 246, 236, 0.75);
}

.glider-a {
  top: 22%;
  animation: glide 42s linear infinite;
}

.glider-b {
  top: 40%;
  animation: glide 58s linear infinite;
  animation-delay: -26s;
  opacity: 0.6;
}

@keyframes glide {
  from {
    transform: translate(-12vw, 4vh) rotate(6deg);
  }
  45% {
    transform: translate(46vw, -3vh) rotate(-4deg);
  }
  to {
    transform: translate(112vw, 2vh) rotate(5deg);
  }
}

.cloud-sea {
  position: absolute;
  left: -10%;
  right: -10%;
  bottom: -12%;
  height: 34%;
  background: radial-gradient(
    ellipse 55% 90% at 50% 100%,
    rgba(255, 205, 175, 0.32) 0%,
    rgba(255, 205, 175, 0.1) 52%,
    transparent 76%
  );
  filter: blur(4px);
}

.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 120% 105% at 50% 42%, transparent 60%, rgba(16, 8, 24, 0.42) 100%);
}

.dim-veil {
  position: absolute;
  inset: 0;
  background: rgba(10, 8, 24, 0.42);
}
</style>

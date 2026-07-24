<script setup lang="ts">
withDefaults(defineProps<{ dim?: boolean }>(), { dim: false });

/** 一次性生成的随机星野 */
const stars = Array.from({ length: 84 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  top: Math.random() * 100,
  size: 0.8 + Math.random() * 1.6,
  delay: Math.random() * 6,
  duration: 2.4 + Math.random() * 3.4,
}));

/** 左右两片遥相呼应的星座 */
const constellationA = [
  { x: 8, y: 18 },
  { x: 15, y: 12 },
  { x: 22, y: 20 },
  { x: 19, y: 30 },
  { x: 11, y: 33 },
];
const constellationB = [
  { x: 78, y: 14 },
  { x: 86, y: 10 },
  { x: 93, y: 17 },
  { x: 90, y: 26 },
  { x: 81, y: 28 },
];

function polyline(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}
</script>

<template>
  <div class="soul-scene" :class="{ dim }" aria-hidden="true">
    <div class="deep-space">
      <!-- 星云 -->
      <span class="nebula nebula-teal" />
      <span class="nebula nebula-rose" />

      <!-- 星野 -->
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

      <!-- 两片相望的星座 -->
      <svg class="constellation constellation-a" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline :points="polyline(constellationA)" />
        <polyline :points="`${constellationA[0].x},${constellationA[0].y} ${constellationA[4].x},${constellationA[4].y}`" />
        <circle v-for="(p, i) in constellationA" :key="i" :cx="p.x" :cy="p.y" r="1.1" />
      </svg>
      <svg class="constellation constellation-b" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline :points="polyline(constellationB)" />
        <polyline :points="`${constellationB[0].x},${constellationB[0].y} ${constellationB[4].x},${constellationB[4].y}`" />
        <circle v-for="(p, i) in constellationB" :key="i" :cx="p.x" :cy="p.y" r="1.1" />
      </svg>

      <!-- 遥遥相望的两颗灵魂之星 -->
      <span class="soul-star soul-a"><i /></span>
      <span class="soul-star soul-b"><i /></span>

      <span class="shooting-star" />
    </div>

    <div class="vignette" />
    <div v-if="dim" class="dim-veil" />
  </div>
</template>

<style scoped>
.soul-scene {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #03051a;
}

.deep-space {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 90% 60% at 24% 20%, rgba(46, 38, 96, 0.5), transparent 70%),
    radial-gradient(ellipse 80% 55% at 78% 76%, rgba(24, 52, 84, 0.55), transparent 72%),
    linear-gradient(180deg, #03051a 0%, #070b28 52%, #0d1038 100%);
}

/* ---------- 星云 ---------- */
.nebula {
  position: absolute;
  width: 44vw;
  height: 44vw;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.16;
}

.nebula-teal {
  top: -10%;
  right: -8%;
  background: radial-gradient(circle, #3fa796, transparent 68%);
  animation: nebula-breathe 14s ease-in-out infinite;
}

.nebula-rose {
  bottom: -14%;
  left: -10%;
  background: radial-gradient(circle, #b06a8a, transparent 68%);
  animation: nebula-breathe 17s ease-in-out infinite reverse;
}

@keyframes nebula-breathe {
  0%,
  100% {
    opacity: 0.1;
    transform: scale(0.94);
  }
  50% {
    opacity: 0.2;
    transform: scale(1.06);
  }
}

/* ---------- 星野 ---------- */
.star {
  position: absolute;
  border-radius: 50%;
  background: #dfe6f7;
  animation: twinkle 4s ease-in-out infinite;
}

/* ---------- 星座 ---------- */
.constellation {
  position: absolute;
  width: 26vw;
  max-width: 340px;
  height: auto;
  aspect-ratio: 1;
  opacity: 0.5;
}

.constellation-a {
  top: 6%;
  left: 4%;
}

.constellation-b {
  top: 4%;
  right: 4%;
}

.constellation polyline {
  fill: none;
  stroke: rgba(190, 205, 240, 0.34);
  stroke-width: 0.35;
  stroke-dasharray: 2 1.6;
}

.constellation circle {
  fill: #e8eefc;
  animation: constellation-glow 5s ease-in-out infinite;
}

@keyframes constellation-glow {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}

/* ---------- 灵魂双星 ---------- */
.soul-star {
  position: absolute;
  top: 50%;
  left: 50%;
  will-change: transform;
}

.soul-star i {
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  animation: soul-pulse 4.4s ease-in-out infinite;
}

.soul-a {
  animation: soul-orbit-a 30s ease-in-out infinite;
}

.soul-a i {
  background: radial-gradient(circle at 40% 36%, #ffe9c4, #f0b57a 62%, rgba(240, 181, 122, 0.12) 100%);
  box-shadow:
    0 0 18px 6px rgba(240, 181, 122, 0.5),
    0 0 60px 22px rgba(240, 181, 122, 0.16);
}

.soul-b {
  animation: soul-orbit-b 30s ease-in-out infinite;
}

.soul-b i {
  background: radial-gradient(circle at 40% 36%, #cdf3ee, #7fd4c9 62%, rgba(127, 212, 201, 0.12) 100%);
  box-shadow:
    0 0 18px 6px rgba(127, 212, 201, 0.5),
    0 0 60px 22px rgba(127, 212, 201, 0.16);
  animation-delay: -2.2s;
}

/* 双星遥遥相望的缓慢舞步：靠近、错过、再靠近 */
@keyframes soul-orbit-a {
  0%,
  100% {
    transform: translate(-21vw, -17vh);
  }
  28% {
    transform: translate(-7vw, 3vh);
  }
  50% {
    transform: translate(-15vw, 15vh);
  }
  76% {
    transform: translate(-24vw, -2vh);
  }
}

@keyframes soul-orbit-b {
  0%,
  100% {
    transform: translate(19vw, 13vh);
  }
  28% {
    transform: translate(6vw, -5vh);
  }
  50% {
    transform: translate(16vw, -16vh);
  }
  76% {
    transform: translate(23vw, 4vh);
  }
}

@keyframes soul-pulse {
  0%,
  100% {
    transform: scale(0.86);
    opacity: 0.82;
  }
  50% {
    transform: scale(1.18);
    opacity: 1;
  }
}

/* ---------- 流星 ---------- */
.shooting-star {
  position: absolute;
  top: 24%;
  left: 70%;
  width: 130px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(223, 230, 247, 0.9), transparent);
  opacity: 0;
  animation: shoot 15s linear infinite;
}

@keyframes shoot {
  0%,
  82% {
    opacity: 0;
    transform: translate(0, 0) rotate(-24deg);
  }
  84% {
    opacity: 1;
  }
  92%,
  100% {
    opacity: 0;
    transform: translate(-32vw, 16vh) rotate(-24deg);
  }
}

/* ---------- 氛围 ---------- */
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 118% 104% at 50% 46%,
    transparent 54%,
    rgba(3, 5, 18, 0.55) 100%
  );
}

.dim-veil {
  position: absolute;
  inset: 0;
  background: rgba(3, 5, 16, 0.46);
}
</style>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), { size: 64 });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- 主星 -->
    <path
      d="M22 12l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8z"
      fill="currentColor"
      opacity="0.92"
    />
    <!-- 相伴的星 -->
    <path
      d="M45 30l2.2 5.8 5.8 2.2-5.8 2.2L45 46l-2.2-5.8-5.8-2.2 5.8-2.2L45 30z"
      fill="currentColor"
      opacity="0.6"
    />
    <!-- 遥遥相连的弧 -->
    <path
      d="M27 40c4.5 6.5 10.5 8.5 17 6"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-dasharray="1 5"
      opacity="0.7"
    />
    <!-- 微星 -->
    <circle cx="14" cy="46" r="1.7" fill="currentColor" opacity="0.45" />
    <circle cx="52" cy="16" r="1.4" fill="currentColor" opacity="0.35" />
  </svg>
</template>

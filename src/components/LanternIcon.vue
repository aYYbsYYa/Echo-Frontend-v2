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
    <!-- 灯笼罩 -->
    <path
      d="M23 14c-4.2 6.4-6.4 13.2-5 21.2 1.3 7.4 6.6 12 14 12s12.7-4.6 14-12c1.4-8-.8-14.8-5-21.2"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
    />
    <path d="M23 14h18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
    <!-- 笺上字句 -->
    <path
      d="M26 29h12M26.5 35.5h11M29 42h6"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      opacity="0.5"
    />
    <!-- 灯芯微光 -->
    <circle cx="32" cy="24" r="2.2" fill="currentColor" opacity="0.75" />
    <!-- 灯座 -->
    <rect x="25" y="47.5" width="14" height="5" rx="2.5" fill="currentColor" opacity="0.85" />
    <!-- 升起的细线 -->
    <path
      d="M32 55.5c0 2.4-1.6 3.2-1.6 5"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      opacity="0.45"
    />
  </svg>
</template>

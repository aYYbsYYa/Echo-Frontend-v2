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
    <!-- 软木塞 -->
    <rect x="25" y="4" width="14" height="9" rx="2.5" fill="currentColor" opacity="0.9" />
    <!-- 瓶身 -->
    <path
      d="M26 13v6.5c0 1.9-.9 3.1-2.3 4.5C20.4 27.2 18 31.6 18 37v11a10 10 0 0 0 10 10h8a10 10 0 0 0 10-10V37c0-5.4-2.4-9.8-5.7-13-1.4-1.4-2.3-2.6-2.3-4.5V13"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
    />
    <path d="M25.5 13h13" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
    <!-- 笺中信 -->
    <rect x="24.5" y="33" width="15" height="17" rx="2" fill="currentColor" opacity="0.28" />
    <path
      d="M28 38h8M28 42h8M28 46h5"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      opacity="0.5"
    />
  </svg>
</template>

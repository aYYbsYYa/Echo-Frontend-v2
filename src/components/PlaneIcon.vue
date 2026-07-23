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
    <path
      d="M3 31.5 61 4 37 60 27.5 41.5 3 31.5Z"
      fill="currentColor"
      opacity="0.92"
    />
    <path
      d="M27.5 41.5 61 4"
      stroke="#0b2436"
      stroke-width="2"
      stroke-linecap="round"
      opacity="0.35"
    />
    <path
      d="M27.5 41.5 20 47"
      stroke="#0b2436"
      stroke-width="2"
      stroke-linecap="round"
      opacity="0.2"
    />
  </svg>
</template>

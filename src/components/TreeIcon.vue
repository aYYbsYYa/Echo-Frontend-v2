<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 24 });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- 三层树冠 -->
    <path d="M12 2.6 8.2 8h7.6L12 2.6Z" fill="currentColor" stroke="none" opacity="0.92" />
    <path d="M12 5.8 6.9 12.4h10.2L12 5.8Z" fill="currentColor" stroke="none" opacity="0.78" />
    <path d="M12 9.4 5.4 17h13.2L12 9.4Z" fill="currentColor" stroke="none" opacity="0.62" />
    <!-- 树干 -->
    <path d="M12 17v4.4" />
    <path d="M9.2 21.4h5.6" opacity="0.7" />
  </svg>
</template>

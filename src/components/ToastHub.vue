<script setup lang="ts">
import { useToasts } from "../store/toast";

const { list } = useToasts();
</script>

<template>
  <div class="toast-hub" aria-live="polite">
    <transition-group name="toast">
      <div v-for="toast in list" :key="toast.id" class="toast" :class="toast.kind">
        <span class="dot" />
        <p>{{ toast.text }}</p>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-hub {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  width: min(92vw, 480px);
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-radius: 999px;
  background: rgba(8, 22, 33, 0.82);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(14px);
  box-shadow: 0 14px 34px rgba(2, 8, 16, 0.5);
  font-size: 14px;
  letter-spacing: 0.04em;
  max-width: 100%;
}

.toast p {
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--teal);
  box-shadow: 0 0 10px var(--teal);
}

.toast.success .dot {
  background: var(--amber);
  box-shadow: 0 0 10px var(--amber);
}

.toast.error .dot {
  background: var(--danger);
  box-shadow: 0 0 10px var(--danger);
}

.toast-enter-active {
  transition: all 0.45s var(--ease-spring);
}
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.92);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}
</style>

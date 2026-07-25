<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const root = ref<HTMLElement>();
const sceneButton = ref<HTMLButtonElement>();
const sceneOpen = ref(false);

const scenes = [
  { label: "海", path: "/ocean" },
  { label: "天", path: "/sky" },
  { label: "森", path: "/forest" },
];

const sceneActive = computed(() => scenes.some((item) => item.path === route.path));
const sceneVisible = computed(() => sceneActive.value || sceneOpen.value);

function closeScene(restoreFocus = false) {
  sceneOpen.value = false;
  if (restoreFocus) nextTick(() => sceneButton.value?.focus());
}

function toggleScene() {
  sceneOpen.value = !sceneOpen.value;
}

function focusSceneItem(index: number) {
  const items = root.value?.querySelectorAll<HTMLAnchorElement>(".scene-item");
  items?.[index]?.focus();
}

function openSceneAt(index: number) {
  sceneOpen.value = true;
  nextTick(() => focusSceneItem(index));
}

function onSceneButtonKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    openSceneAt(0);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    openSceneAt(scenes.length - 1);
  } else if (event.key === "Escape") {
    closeScene(true);
  }
}

function onSceneItemKeydown(event: KeyboardEvent, index: number) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeScene(true);
    return;
  }

  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const step = event.key === "ArrowDown" ? 1 : -1;
  const next = (index + step + scenes.length) % scenes.length;
  focusSceneItem(next);
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) closeScene();
}

watch(
  () => route.fullPath,
  () => closeScene(),
);

onMounted(() => document.addEventListener("pointerdown", onDocumentPointerDown));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocumentPointerDown));
</script>

<template>
  <nav ref="root" class="shared-nav" aria-label="主导航">
    <RouterLink to="/echo" class="nav-item" :class="{ active: route.path === '/echo' }">灵</RouterLink>
    <RouterLink to="/soul" class="nav-item" :class="{ active: route.path === '/soul' }">魂</RouterLink>
    <div class="scene-menu" @mouseenter="sceneOpen = true" @mouseleave="closeScene()">
      <button
        ref="sceneButton"
        class="nav-item scene-trigger"
        :class="{ active: sceneActive, open: sceneVisible }"
        type="button"
        aria-haspopup="menu"
        :aria-expanded="sceneVisible"
        aria-controls="scene-navigation"
        @click="toggleScene"
        @keydown="onSceneButtonKeydown"
      >
        景
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      <Transition name="scene-menu">
        <div v-if="sceneVisible" id="scene-navigation" class="scene-popover" role="menu">
          <RouterLink
            v-for="(item, index) in scenes"
            :key="item.path"
            :to="item.path"
            class="scene-item"
            :class="{ active: route.path === item.path }"
            role="menuitem"
            @click="closeScene()"
            @keydown="onSceneItemKeydown($event, index)"
          >
            {{ item.label }}
          </RouterLink>
        </div>
      </Transition>
    </div>
  </nav>
</template>

<style scoped>
.shared-nav {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 8px 28px rgba(2, 8, 16, 0.12);
}

.nav-item {
  min-width: 42px;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 14px;
  border-radius: 999px;
  color: var(--ink-dim);
  font-size: 13.5px;
  line-height: 1;
  letter-spacing: 0.14em;
  text-decoration: none;
  transition: background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease;
}

.nav-item:hover,
.nav-item:focus-visible,
.nav-item.active {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.14);
}

.nav-item:focus-visible,
.scene-item:focus-visible {
  outline: 2px solid rgba(236, 245, 246, 0.72);
  outline-offset: 2px;
}

.scene-menu {
  position: relative;
}

.scene-trigger svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.25s ease;
}

.scene-trigger.open svg {
  transform: rotate(180deg);
}

.scene-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(3, 42px);
  gap: 4px;
  padding: 5px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: rgba(9, 16, 25, 0.82);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 18px 44px rgba(2, 8, 16, 0.35);
}

.scene-item {
  display: grid;
  place-items: center;
  min-height: 38px;
  border-radius: 8px;
  color: var(--ink-dim);
  font-size: 13.5px;
  letter-spacing: 0.12em;
  text-decoration: none;
  transition: background 0.22s ease, color 0.22s ease;
}

.scene-item:hover,
.scene-item:focus-visible,
.scene-item.active {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.13);
}

.scene-menu-enter-active,
.scene-menu-leave-active {
  transform-origin: top right;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.scene-menu-enter-from,
.scene-menu-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.96);
}

@media (max-width: 560px) {
  .nav-item {
    min-width: 38px;
    padding: 7px 10px;
  }

  .scene-popover {
    right: -4px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-item,
  .scene-trigger svg,
  .scene-item,
  .scene-menu-enter-active,
  .scene-menu-leave-active {
    transition: none;
  }
}
</style>

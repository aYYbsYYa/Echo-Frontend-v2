import { createRouter, createWebHistory } from "vue-router";
import { useIdentity } from "./store/identity";

const WelcomeView = () => import("./views/WelcomeView.vue");
const HomeView = () => import("./views/HomeView.vue");
const ForestView = () => import("./views/ForestView.vue");
const MineView = () => import("./views/MineView.vue");

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/welcome", name: "welcome", component: WelcomeView, meta: { mode: "sky" } },
    { path: "/", name: "sky", component: HomeView, meta: { mode: "sky" } },
    { path: "/ocean", name: "ocean", component: HomeView, meta: { mode: "ocean" } },
    { path: "/forest", name: "forest", component: ForestView, meta: { mode: "forest" } },
    { path: "/mine", name: "mine", component: MineView, meta: { mode: "sky" } },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

const identity = useIdentity();

router.beforeEach(async (to) => {
  if (!identity.state.ready) await identity.bootstrap();
  const loggedIn = Boolean(identity.state.user);
  if (!loggedIn && to.name !== "welcome") return { name: "welcome" };
  if (loggedIn && to.name === "welcome") return { name: "ocean" };
  return true;
});

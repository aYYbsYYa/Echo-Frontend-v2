import { reactive } from "vue";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

const list = reactive<Toast[]>([]);
let seq = 0;

export function pushToast(text: string, kind: ToastKind = "info", duration = 2800) {
  const id = ++seq;
  list.push({ id, kind, text });
  window.setTimeout(() => {
    const index = list.findIndex((t) => t.id === id);
    if (index >= 0) list.splice(index, 1);
  }, duration);
}

export function useToasts() {
  return { list, push: pushToast };
}

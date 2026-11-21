import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
export function useRouteParam<T extends string>(
  name: string,
  fallback: T,
  allowed?: readonly string[],
): [T, (next: T) => void] {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  const params = new URLSearchParams(hash.split("?")[1]);
  const value = params.get(name);
  function set(next: T) {
    const [path, query] = location.hash.split("?");
    const updated = new URLSearchParams(query);
    if (next === fallback || !next) updated.delete(name);
    else updated.set(name, next);
    location.hash = path + (updated.size ? "?" + updated.toString() : "");
  }
  return [
    value && (!allowed || allowed.includes(value)) ? (value as T) : fallback,
    set,
  ];
}

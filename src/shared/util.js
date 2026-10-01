export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

export function normalize(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function useMockData() {
  return (process.env.USE_MOCK_DATA ?? "true").toLowerCase() === "true";
}

export function env(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

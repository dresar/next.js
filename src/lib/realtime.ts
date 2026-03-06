type RealtimeEvent =
  | { type: "ws:ready" }
  | { type: "measurement:new"; data: any }
  | { type: "device:status"; data: any }
  | { type: "device:warning"; data: any };

type Listener = (evt: RealtimeEvent) => void;

let ws: WebSocket | null = null;
let listeners = new Set<Listener>();
let reconnectTimer: number | null = null;

function getToken() {
  return localStorage.getItem("auth_token");
}

function wsUrl() {
  const token = getToken();
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const base = `${proto}://${window.location.host}/api/ws`;
  return `${base}?token=${encodeURIComponent(token ?? "")}`;
}

function ensureConnected() {
  const token = getToken();
  if (!token) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  try {
    ws = new WebSocket(wsUrl());
  } catch {
    return;
  }

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(String(e.data)) as RealtimeEvent;
      for (const l of listeners) l(msg);
    } catch {
      // ignore
    }
  };

  ws.onclose = () => {
    ws = null;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => ensureConnected(), 1500);
  };
}

export function subscribeRealtime(listener: Listener) {
  listeners.add(listener);
  ensureConnected();
  return () => {
    listeners.delete(listener);
  };
}

export function reconnectRealtime() {
  if (ws) {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }
  ws = null;
  ensureConnected();
}


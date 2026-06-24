// useWorldSocket.js
// Subscribes to the backend world stream and returns the latest Alter state.
// Reconnects automatically. Pairs with sim_router.py's /ws/world endpoint.

import { useEffect, useRef, useState } from "react";

const WS_URL =
  (import.meta.env.VITE_API_URL || "http://localhost:8000")
    .replace(/^http/, "ws") + "/ws/world";

export function useWorldSocket() {
  const [alter, setAlter] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    let stop = false;
    let retry;

    const connect = () => {
      if (stop) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "alter_state") setAlter(msg.alter);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stop) retry = setTimeout(connect, 1000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      stop = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  // Optional manual override for testing (sends {action, target}).
  const sendAction = (action, target) =>
    wsRef.current?.readyState === WebSocket.OPEN &&
    wsRef.current.send(JSON.stringify({ action, target }));

  return { alter, connected, sendAction };
}

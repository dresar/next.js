import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { verifyAccessToken } from "../auth/jwt.js";

const envSchema = z.object({
  WS_PATH: z.string().optional().default("/api/ws"),
});
const env = envSchema.parse(process.env);

type WsWithAuth = WebSocket & { auth?: { id: string; email: string } };

let wss: WebSocketServer | null = null;

export function attachWebsocketServer(server: import("node:http").Server) {
  wss = new WebSocketServer({ server, path: env.WS_PATH });

  wss.on("connection", (socket: WsWithAuth, req) => {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const token = url.searchParams.get("token");
      if (!token) {
        socket.close(1008, "Missing token");
        return;
      }
      socket.auth = verifyAccessToken(token);
      socket.send(JSON.stringify({ type: "ws:ready" }));
    } catch {
      socket.close(1008, "Invalid token");
    }
  });
}

export type BroadcastFn = (msg: unknown) => void;

export function broadcastJson(msg: unknown) {
  if (!wss) return;
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}


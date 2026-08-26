import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

let socket: Socket | null = null;

/** Singleton Socket.io client — connects lazily on first use (AUC-11/AUC-21/AUC-24). */
export function getSocket(): Socket {
  if (!socket) {
    const socketUrl = API_BASE_URL.replace(/\/api\/?$/, "");
    socket = io(socketUrl, { autoConnect: true, transports: ["websocket"] });
  }
  return socket;
}

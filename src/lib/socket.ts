import { io, Socket } from "socket.io-client";
import { API_URL } from "./api";

// Falls back to the API host; normalised to an absolute URL (with scheme).
const RAW_SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL || "http://localhost:5008";
const SOCKET_URL = (() => {
  let u = String(RAW_SOCKET_URL).trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
})();

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
  }
  return socket;
}

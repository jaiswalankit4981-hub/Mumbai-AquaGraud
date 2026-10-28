import { Server } from 'socket.io';
import { env } from '../config/env.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.clientOrigin } });
  io.on('connection', (socket) => {
    socket.on('join', (room) => socket.join(room)); // "citizens" or "admins"
  });
  console.log('[realtime] socket.io ready');
  return io;
}

/** Broadcast an event to everyone, or to a single room. */
export function emit(event, payload, room) {
  if (!io) return;
  (room ? io.to(room) : io).emit(event, payload);
}

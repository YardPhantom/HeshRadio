import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

/**
 * Embedded Multi-Peer CB PTT & Tactical Telemetry Relay Server.
 * Allows Windows Desktop and Samsung S26 Ultra on the same LAN to communicate
 * live over Virtual CB Channels 1-40 (voice frames, PTT key-ups, and text/traffic spots).
 */
function heshRadioPttRelayPlugin(): Plugin {
  return {
    name: 'heshradio-ptt-relay',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      const clients = new Set<WebSocket>();

      server.httpServer?.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        if (req.url === '/ws-cb') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      wss.on('connection', (ws: WebSocket) => {
        clients.add(ws);
        // Broadcast updated peer count
        const peerMsg = JSON.stringify({ type: 'PEER_COUNT', count: clients.size });
        for (const c of clients) {
          if (c.readyState === WebSocket.OPEN) c.send(peerMsg);
        }

        ws.on('message', (data: Buffer, isBinary: boolean) => {
          for (const client of clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(data, { binary: isBinary });
            }
          }
        });

        ws.on('close', () => {
          clients.delete(ws);
          const closeMsg = JSON.stringify({ type: 'PEER_COUNT', count: clients.size });
          for (const c of clients) {
            if (c.readyState === WebSocket.OPEN) c.send(closeMsg);
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), heshRadioPttRelayPlugin()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
  },
});

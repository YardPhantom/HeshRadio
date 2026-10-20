import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { CURATED_FM_STATIONS, FM_CATEGORIES, categoryIdForGenre } from './src/radio/fmRadioService';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import net from 'net';

/**
 * Embedded Multi-Peer CB PTT & Tactical Telemetry Relay Server
 * + Local TCP Bridge for rtl_tcp (127.0.0.1:1234) and Hamlib rigctld (127.0.0.1:4532).
 */
function heshRadioPttRelayPlugin(): Plugin {
  return {
    name: 'heshradio-ptt-relay',
    configureServer(server) {
      const cbWss = new WebSocketServer({ noServer: true });
      const rtlTcpWss = new WebSocketServer({ noServer: true });
      const rigctldWss = new WebSocketServer({ noServer: true });
      const clients = new Set<WebSocket>();

      server.httpServer?.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = urlObj.pathname;

        if (pathname === '/ws-cb') {
          cbWss.handleUpgrade(req, socket, head, (ws) => {
            cbWss.emit('connection', ws, req);
          });
        } else if (pathname === '/ws-rtltcp') {
          rtlTcpWss.handleUpgrade(req, socket, head, (ws) => {
            rtlTcpWss.emit('connection', ws, req);
          });
        } else if (pathname === '/ws-rigctld') {
          rigctldWss.handleUpgrade(req, socket, head, (ws) => {
            rigctldWss.emit('connection', ws, req);
          });
        }
      });

      // 1. Virtual CB Corridor & LAN Audio/Traffic Relay
      cbWss.on('connection', (ws: WebSocket) => {
        clients.add(ws);
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

      // 2. rtl_tcp TCP Socket Bridge (default 127.0.0.1:1234)
      rtlTcpWss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const urlObj = new URL(req.url || '/', 'http://localhost');
        const target = urlObj.searchParams.get('target') || '127.0.0.1:1234';
        const [host, portStr] = target.split(':');
        const port = parseInt(portStr, 10) || 1234;

        const tcpSocket = net.createConnection({ host, port }, () => {
          console.log(`[RTL_TCP Bridge] Connected to TCP rtl_tcp daemon at ${host}:${port}`);
        });

        tcpSocket.on('data', (chunk) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(chunk);
          }
        });

        tcpSocket.on('error', (err) => {
          console.warn(`[RTL_TCP Bridge] TCP socket error: ${err.message}`);
          ws.close();
        });

        tcpSocket.on('close', () => {
          ws.close();
        });

        ws.on('message', (msg: Buffer) => {
          tcpSocket.write(msg);
        });

        ws.on('close', () => {
          tcpSocket.end();
        });
      });

      // 3. Hamlib rigctld TCP Socket Bridge (default 127.0.0.1:4532)
      rigctldWss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const urlObj = new URL(req.url || '/', 'http://localhost');
        const target = urlObj.searchParams.get('target') || '127.0.0.1:4532';
        const [host, portStr] = target.split(':');
        const port = parseInt(portStr, 10) || 4532;

        const tcpSocket = net.createConnection({ host, port }, () => {
          console.log(`[Rigctld Bridge] Connected to TCP Hamlib rigctld daemon at ${host}:${port}`);
        });

        tcpSocket.on('data', (chunk) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(chunk.toString('utf-8'));
          }
        });

        tcpSocket.on('error', (err) => {
          console.warn(`[Rigctld Bridge] TCP socket error: ${err.message}`);
          ws.close();
        });

        tcpSocket.on('close', () => {
          ws.close();
        });

        ws.on('message', (msg: string | Buffer) => {
          tcpSocket.write(msg.toString());
        });

        ws.on('close', () => {
          tcpSocket.end();
        });
      });
    },
  };
}

/**
 * Publishes the curated FM station list as a static manifest (dist/stations.json) so HCloud's
 * "HeshRadio FM" page can list the same stations HeshRadio plays and deep link back into this
 * app via `#/fm/<station-id>`. Deterministic output: no timestamps, stable field order.
 * `categories` is HeshRadio's full pill taxonomy (the "ALL" control is a UI decision, so
 * HCloud renders its own "All" pill); each station carries the resolved `category` id so
 * HCloud filters by exactly the categories this app has.
 * Custom streams live in the operator's localStorage, so they are not part of the manifest.
 */
function fmStationManifestPlugin(): Plugin {
  const manifest = () =>
    JSON.stringify(
      {
        ok: true,
        count: CURATED_FM_STATIONS.length,
        categories: FM_CATEGORIES.filter((c) => c.id !== 'ALL').map((c) => ({ id: c.id, label: c.label })),
        stations: CURATED_FM_STATIONS.map((station) => ({
          id: station.id,
          name: station.name,
          frequencyMhz: station.frequencyMhz,
          genre: station.genre,
          category: categoryIdForGenre(station.genre),
          country: station.country,
          countryCode: station.countryCode ?? '',
          state: station.state ?? '',
          bitrate: station.bitrate,
          codec: station.codec,
          streamUrl: station.streamUrl,
        })),
      },
      null,
      2,
    );

  return {
    name: 'heshradio-station-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'stations.json', source: manifest() });
    },
    // Dev server parity so `vite dev` answers the same file the built site serves.
    configureServer(server) {
      server.middlewares.use('/stations.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(manifest());
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), heshRadioPttRelayPlugin(), fmStationManifestPlugin()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
  },
});

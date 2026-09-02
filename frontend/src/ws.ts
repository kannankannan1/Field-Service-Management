import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getToken } from './api/client';

type Listener = (payload: unknown) => void;

const listeners = new Set<Listener>();
let client: Client | null = null;
let connected = false;

export function onNotification(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(payload: unknown) {
  listeners.forEach((l) => l(payload));
}

export function connectWebSocket(): void {
  if (client || !getToken()) {
    return;
  }
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  const backendUrl = apiUrl.replace(/\/+$/, '');
  const wsUrl = backendUrl ? backendUrl + '/ws' : '/ws';
  const sock = new SockJS(wsUrl);
  client = new Client({
    webSocketFactory: () => sock,
    connectHeaders: {
      Authorization: `Bearer ${getToken()}`,
    },
    reconnectDelay: 5000,
    debug: () => undefined,
    onConnect: () => {
      connected = true;
      client?.subscribe('/user/queue/notifications', (message) => {
        try {
          notify(JSON.parse(message.body));
        } catch {
          notify({ message: message.body });
        }
      });
    },
    onStompError: () => {
      connected = false;
    },
    onWebSocketClose: () => {
      connected = false;
    },
  });
  client.activate();
}

export function disconnectWebSocket(): void {
  if (client) {
    try {
      client.deactivate();
    } catch {
      // ignore
    }
  }
  client = null;
  connected = false;
}

export function isConnected(): boolean {
  return connected;
}

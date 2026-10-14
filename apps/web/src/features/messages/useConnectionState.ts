import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@sideband/contracts';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketInstance: TypedSocket | null = null;
let currentStatus: ConnectionStatus = 'connecting';
let currentError: string | null = null;
const stateListeners = new Set<(state: { status: ConnectionStatus; error: string | null }) => void>();

function notifyListeners() {
  const state = { status: currentStatus, error: currentError };
  stateListeners.forEach((listener) => listener(state));
}

function initSocket(): TypedSocket {
  if (socketInstance) return socketInstance;

  socketInstance = io({
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  currentStatus = socketInstance.connected ? 'connected' : 'connecting';

  socketInstance.on('connect', () => {
    currentStatus = 'connected';
    currentError = null;
    notifyListeners();
  });

  socketInstance.on('disconnect', (reason) => {
    currentStatus = 'disconnected';
    if (reason === 'io server disconnect') {
      // the disconnection was initiated by the server, reconnect manually
      socketInstance?.connect();
    }
    notifyListeners();
  });

  socketInstance.on('connect_error', (err) => {
    currentStatus = 'error';
    currentError = err.message || 'Connection error';
    notifyListeners();
  });

  return socketInstance;
}

export function getSocket(): TypedSocket {
  if (!socketInstance) {
    return initSocket();
  }
  return socketInstance;
}

export function reconnectSocket(): void {
  if (!socketInstance) {
    initSocket();
    notifyListeners();
    return;
  }
  currentStatus = 'connecting';
  currentError = null;
  notifyListeners();
  if (socketInstance.disconnected) {
    socketInstance.connect();
  }
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
    currentStatus = 'disconnected';
    currentError = null;
    notifyListeners();
  }
}

export function useConnectionState() {
  const [state, setState] = useState<{ status: ConnectionStatus; error: string | null }>({
    status: currentStatus,
    error: currentError,
  });

  useEffect(() => {
    const sock = initSocket();
    if (sock.disconnected && (currentStatus === 'disconnected' || currentStatus === 'error')) {
      reconnectSocket();
    }
    setState({ status: currentStatus, error: currentError });

    const handleStateChange = (nextState: { status: ConnectionStatus; error: string | null }) => {
      setState(nextState);
    };

    stateListeners.add(handleStateChange);
    return () => {
      stateListeners.delete(handleStateChange);
    };
  }, []);

  const reconnect = useCallback(() => {
    reconnectSocket();
  }, []);

  return {
    status: state.status,
    error: state.error,
    reconnect,
  };
}

export default useConnectionState;

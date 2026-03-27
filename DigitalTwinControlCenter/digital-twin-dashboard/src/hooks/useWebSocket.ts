import { useEffect, useRef, useState } from 'react';
import webSocketService, { SystemStateUpdate, WebSocketCallbacks } from '@/lib/webSocketService';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  onSystemStateUpdate?: (update: SystemStateUpdate) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  
  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (options.autoConnect !== false) {
      const callbacks: WebSocketCallbacks = {
        onConnect: () => {
          setIsConnected(true);
          setConnectionError(null);
          if (optionsRef.current.onConnect) {
            optionsRef.current.onConnect();
          }
        },
        onDisconnect: () => {
          setIsConnected(false);
          if (optionsRef.current.onDisconnect) {
            optionsRef.current.onDisconnect();
          }
        },
        onError: (error) => {
          setConnectionError(error?.message || 'WebSocket connection error');
          setIsConnected(false);
          if (optionsRef.current.onError) {
            optionsRef.current.onError(error);
          }
        },
        onSystemStateUpdate: (update) => {
          if (optionsRef.current.onSystemStateUpdate) {
            optionsRef.current.onSystemStateUpdate(update);
          }
        }
      };

      webSocketService.connect(callbacks);
    }

    return () => {
      // Don't disconnect on unmount as other components might be using it
      // webSocketService.disconnect();
    };
  }, []);

  const connect = () => {
    const callbacks: WebSocketCallbacks = {
      onConnect: () => {
        setIsConnected(true);
        setConnectionError(null);
        if (optionsRef.current.onConnect) {
          optionsRef.current.onConnect();
        }
      },
      onDisconnect: () => {
        setIsConnected(false);
        if (optionsRef.current.onDisconnect) {
          optionsRef.current.onDisconnect();
        }
      },
      onError: (error) => {
        setConnectionError(error?.message || 'WebSocket connection error');
        setIsConnected(false);
        if (optionsRef.current.onError) {
          optionsRef.current.onError(error);
        }
      },
      onSystemStateUpdate: (update) => {
        if (optionsRef.current.onSystemStateUpdate) {
          optionsRef.current.onSystemStateUpdate(update);
        }
      }
    };

    webSocketService.connect(callbacks);
  };

  const disconnect = () => {
    webSocketService.disconnect();
    setIsConnected(false);
  };

  const subscribeToSystem = (systemId: string, callback: (update: SystemStateUpdate) => void) => {
    return webSocketService.subscribeToSystem(systemId, callback);
  };

  const subscribeToSystemEvents = (systemId: string, callback: (update: SystemStateUpdate) => void) => {
    return webSocketService.subscribeToSystemEvents(systemId, callback);
  };

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    subscribeToSystem,
    subscribeToSystemEvents
  };
}

// Hook for subscribing to a specific system
export function useSystemWebSocket(systemId: string | null, enabled = true) {
  const [systemState, setSystemState] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!systemId || !enabled) {
      return;
    }

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Subscribe to system state updates
    const unsubscribe = webSocketService.subscribeToSystem(systemId, (update) => {
      console.log(`WebSocket update for ${systemId}:`, update);
      setSystemState(update.data);
      setLastUpdate(Date.now());
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [systemId, enabled]);

  return {
    systemState,
    lastUpdate
  };
}

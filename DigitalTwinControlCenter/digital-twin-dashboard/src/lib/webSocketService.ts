// Simplified WebSocket service - will be enhanced with real WebSocket later

export interface SystemStateUpdate {
  systemId: string;
  type: 'STATE_UPDATE' | 'EVENT_RAISED' | 'COMPONENT_UPDATE';
  timestamp: number;
  data: any;
}

export interface WebSocketCallbacks {
  onSystemStateUpdate?: (update: SystemStateUpdate) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

class WebSocketService {
  private connected = false;
  private callbacks: WebSocketCallbacks = {};

  constructor() {
    // For now, this is a placeholder service
  }

  // Connect to WebSocket (simulated)
  connect(callbacks: WebSocketCallbacks = {}) {
    this.callbacks = callbacks;

    if (this.connected) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Simulating WebSocket connection...');

    // Simulate successful connection
    setTimeout(() => {
      this.connected = true;
      console.log('WebSocket connected (simulated)');

      if (this.callbacks.onConnect) {
        this.callbacks.onConnect();
      }
    }, 100);
  }

  // Subscribe to system updates (simulated)
  subscribeToSystem(systemId: string, callback: (update: SystemStateUpdate) => void) {
    console.log(`Simulated subscription to system: ${systemId}`);

    // Return unsubscribe function
    return () => {
      console.log(`Unsubscribed from system: ${systemId}`);
    };
  }

  // Subscribe to system events (simulated)
  subscribeToSystemEvents(systemId: string, callback: (update: SystemStateUpdate) => void) {
    console.log(`Simulated subscription to system events: ${systemId}`);

    // Return unsubscribe function
    return () => {
      console.log(`Unsubscribed from system events: ${systemId}`);
    };
  }

  // Disconnect from WebSocket (simulated)
  disconnect() {
    if (this.connected) {
      console.log('WebSocket disconnected (simulated)');
      this.connected = false;

      if (this.callbacks.onDisconnect) {
        this.callbacks.onDisconnect();
      }
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.connected;
  }

  // Simulate sending a message
  send(destination: string, body: any) {
    if (this.connected) {
      console.log(`Simulated message sent to ${destination}:`, body);
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;

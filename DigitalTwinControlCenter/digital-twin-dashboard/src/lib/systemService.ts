import FirebaseService from '@/lib/firebaseService';
import SimulationService from '@/lib/simulationService';
import { getFirebaseConfig } from '@/config/firebaseConfig';
import { getSimulationConfig } from '@/config/simulationConfig';

// Unified service that switches between Firebase and Simulation based on mode
export class SystemService {
  private static currentMode: 'real' | 'simulated' = 'real';
  private static isInitialized = false;

  // Initialize the service with the specified mode
  static async initialize(mode: 'real' | 'simulated') {
    this.currentMode = mode;
    
    if (mode === 'real') {
      const config = getFirebaseConfig();
      FirebaseService.initialize(config);
    } else {
      const config = getSimulationConfig();
      SimulationService.initialize(config);
    }
    
    this.isInitialized = true;
    console.log(`SystemService initialized in ${mode} mode`);
  }

  // Switch mode (reinitialize if needed)
  static async switchMode(mode: 'real' | 'simulated') {
    if (this.currentMode !== mode) {
      await this.initialize(mode);
    }
  }

  // Get current mode
  static getCurrentMode(): 'real' | 'simulated' {
    return this.currentMode;
  }

  // Get system state
  static async getSystemState(systemName: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('SystemService not initialized');
    }

    if (this.currentMode === 'real') {
      return await FirebaseService.getSystemState(systemName);
    } else {
      // For simulation, we need to get the systemId first
      // This would typically be managed by the simulation store
      throw new Error('Use simulation store for simulated mode');
    }
  }

  // Update system state
  static async updateSystemState(systemName: string, state: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SystemService not initialized');
    }

    if (this.currentMode === 'real') {
      await FirebaseService.updateSystemState(systemName, state);
    } else {
      await SimulationService.updateSystemState(systemName, state);
    }
  }

  // Get component state
  static async getComponentState(systemName: string, componentName: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('SystemService not initialized');
    }

    if (this.currentMode === 'real') {
      return await FirebaseService.getComponentState(systemName, componentName);
    } else {
      // For simulation, we need to get the systemId first
      // This would typically be managed by the simulation store
      throw new Error('Use simulation store for simulated mode');
    }
  }

  // Update component state
  static async updateComponentState(systemName: string, componentName: string, state: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SystemService not initialized');
    }

    if (this.currentMode === 'real') {
      await FirebaseService.updateComponentState(systemName, componentName, state);
    } else {
      await SimulationService.updateComponentState(systemName, componentName, state);
    }
  }

  // Execute action
  static async executeAction(systemName: string, componentName: string, action: string, params?: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SystemService not initialized');
    }

    if (this.currentMode === 'real') {
      await FirebaseService.executeAction(systemName, componentName, action, params);
    } else {
      // For simulation, we need to get the systemId first
      // This would typically be managed by the simulation store
      throw new Error('Use simulation store for simulated mode');
    }
  }

  // Subscribe to system state changes
  static subscribeToSystemState(systemName: string, callback: (data: any) => void): () => void {
    if (!this.isInitialized) {
      throw new Error('SystemService not initialized');
    }

    if (this.currentMode === 'real') {
      return FirebaseService.subscribeToSystemState(systemName, callback);
    } else {
      return SimulationService.subscribeToSystemState(systemName, callback);
    }
  }

  // Subscribe to component state changes
  static subscribeToComponentState(systemName: string, componentName: string, callback: (data: any) => void): () => void {
    if (!this.isInitialized) {
      throw new Error('SystemService not initialized');
    }

    if (this.currentMode === 'real') {
      return FirebaseService.subscribeToComponentState(systemName, componentName, callback);
    } else {
      return SimulationService.subscribeToComponentState(systemName, componentName, callback);
    }
  }
}

export default SystemService;

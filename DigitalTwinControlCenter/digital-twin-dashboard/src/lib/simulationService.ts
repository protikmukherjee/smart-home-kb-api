import {
  getSystemSimulationConfig,
  getSimulationEndpoint,
  getActionSimulationConfig,
  getSensorSimulationConfig,
  getPropertySimulationConfig,
  buildEndpointUrl,
  getSystemType
} from '@/config/simulationUrlConfig';

// Simplified Simulation service for simulated mode
export class SimulationService {
  private static baseUrl: string = '';

  static initialize(config: { apiUrl: string }) {
    this.baseUrl = config.apiUrl;
  }

  // Initialize all systems at once
  static async initializeAllSystems(): Promise<any> {
    console.log('SimulationService: Initializing all systems');

    try {
      const endpoint = '/api/statechart/initialize';
      const response = await this.callJavaAPI(endpoint, 'POST');
      console.log('SimulationService: All systems initialized:', response);
      return response;
    } catch (error) {
      console.error('SimulationService: Failed to initialize all systems:', error);
      throw error;
    }
  }

  // Get all systems
  static async getAllSystems(): Promise<any> {
    console.log('SimulationService: Getting all systems');

    try {
      const endpoint = '/api/statechart/systems';
      const response = await this.callJavaAPI(endpoint, 'GET');
      console.log('SimulationService: All systems retrieved:', response);
      return response;
    } catch (error) {
      console.error('SimulationService: Failed to get all systems:', error);
      throw error;
    }
  }

  // Java Bridge API calls
  private static async callJavaAPI(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const fullUrl = `${this.baseUrl}${endpoint}`;
    console.log(`SimulationService: Making ${method} request to ${fullUrl}`);

    try {
      const response = await fetch(fullUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      console.log(`SimulationService: Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`SimulationService: HTTP error! status: ${response.status}, body: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`SimulationService: Response data:`, result);
      return result;
    } catch (error) {
      console.error(`SimulationService: Java API call failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Create system
  static async createSystem(systemName: string): Promise<string> {
    console.log(`SimulationService: Creating system ${systemName}`);

    const config = getSystemSimulationConfig(systemName);
    if (!config) {
      console.error(`SimulationService: No simulation configuration found for system: ${systemName}`);
      throw new Error(`No simulation configuration found for system: ${systemName}`);
    }

    const systemId = `${systemName}_${Date.now()}`;
    const endpoint = buildEndpointUrl(config.endpoints.create.endpoint, systemId);

    console.log(`SimulationService: Calling API endpoint: ${endpoint}`);
    const response = await this.callJavaAPI(endpoint, config.endpoints.create.method);
    console.log(`SimulationService: API response:`, response);

    return systemId;
  }

  // Start system
  static async startSystem(systemId: string, systemName: string): Promise<void> {
    const config = getSystemSimulationConfig(systemName);
    if (!config) {
      throw new Error(`No simulation configuration found for system: ${systemName}`);
    }

    const endpoint = buildEndpointUrl(config.endpoints.start.endpoint, systemId);
    await this.callJavaAPI(endpoint, config.endpoints.start.method);
  }

  // Stop system
  static async stopSystem(systemId: string, systemName: string): Promise<void> {
    const config = getSystemSimulationConfig(systemName);
    if (!config) {
      throw new Error(`No simulation configuration found for system: ${systemName}`);
    }

    const endpoint = buildEndpointUrl(config.endpoints.stop.endpoint, systemId);
    await this.callJavaAPI(endpoint, config.endpoints.stop.method);
  }

  // Get system state
  static async getSystemState(systemId: string, systemName: string): Promise<any> {
    const config = getSystemSimulationConfig(systemName);
    if (!config) {
      throw new Error(`No simulation configuration found for system: ${systemName}`);
    }

    const endpoint = buildEndpointUrl(config.endpoints.getState.endpoint, systemId);
    return await this.callJavaAPI(endpoint, config.endpoints.getState.method);
  }

  // Get component state
  static async getComponentState(systemId: string, systemName: string, componentName: string): Promise<any> {
    // For now, return the system state as component state is part of it
    const systemState = await this.getSystemState(systemId, systemName);
    return systemState.components?.[componentName] || {};
  }

  // Get property value from system state
  static async getPropertyValue(systemId: string, systemName: string, componentName: string, propertyName: string): Promise<any> {
    // Get the property value from the system state response
    const systemState = await this.getSystemState(systemId, systemName);
    const componentState = systemState.components?.[componentName];

    if (componentState && componentState[propertyName] !== undefined) {
      return componentState[propertyName];
    }

    // If not found in components, check system-level properties
    if (systemState[propertyName] !== undefined) {
      return systemState[propertyName];
    }

    return null;
  }

  // Set environment data for sensors
  static async setEnvironmentData(systemId: string, systemName: string, sensorName: string, data: any): Promise<void> {
    const sensorConfig = getSensorSimulationConfig(systemName, sensorName);
    if (!sensorConfig) {
      // Fallback to generic endpoint if specific sensor config not found
      const config = getSystemSimulationConfig(systemName);
      if (!config) {
        throw new Error(`No simulation configuration found for system: ${systemName}`);
      }
      const endpoint = buildEndpointUrl(config.endpoints.setEnvironmentData.endpoint, systemId);
      await this.callJavaAPI(`${endpoint}?sensorType=${sensorName}&value=${data.environmentData || data}`, 'POST');
      return;
    }

    const value = data.environmentData !== undefined ? data.environmentData : data;
    const endpoint = buildEndpointUrl(sensorConfig.endpoint, systemId, value);
    await this.callJavaAPI(endpoint, sensorConfig.method);
  }

  // Raise event on component
  static async raiseEvent(systemId: string, systemName: string, componentName: string, eventName: string, params?: any): Promise<void> {
    const actionConfig = getActionSimulationConfig(systemName, componentName, eventName);
    if (!actionConfig) {
      // Fallback to generic endpoint if specific action config not found
      const config = getSystemSimulationConfig(systemName);
      if (!config) {
        throw new Error(`No simulation configuration found for system: ${systemName}`);
      }
      const endpoint = buildEndpointUrl(config.endpoints.raiseEvent.endpoint, systemId);
      await this.callJavaAPI(`${endpoint}?componentName=${componentName}&eventName=${eventName}`, 'POST');
      return;
    }

    const endpoint = buildEndpointUrl(actionConfig.endpoint, systemId);
    await this.callJavaAPI(endpoint, actionConfig.method);
  }

  // Run statechart cycle
  static async runCycle(systemId: string, systemName: string): Promise<void> {
    const config = getSystemSimulationConfig(systemName);
    if (!config) {
      throw new Error(`No simulation configuration found for system: ${systemName}`);
    }

    const endpoint = buildEndpointUrl(config.endpoints.runCycle.endpoint, systemId);
    await this.callJavaAPI(endpoint, config.endpoints.runCycle.method);
  }

  // Execute command/action (maps to raiseEvent)
  static async executeAction(systemId: string, systemName: string, componentName: string, action: string, params?: any): Promise<void> {
    // Map action names to event names based on the Java statechart structure
    const actionEventMap: Record<string, string> = {
      'open': 'raiseOpen_door',
      'close': 'raiseClose_door',
      'turnOn': 'raiseTurn_on',
      'turnOff': 'raiseTurn_off',
      'start': 'raiseStart',
      'stop': 'raiseStop'
    };

    // If action already starts with "raise", use it as-is, otherwise map it
    let eventName: string;
    if (action.startsWith('raise')) {
      eventName = action;
    } else {
      eventName = actionEventMap[action] || `raise${action.charAt(0).toUpperCase() + action.slice(1)}`;
    }

    console.log(`SimulationService: Mapping action '${action}' to event '${eventName}'`);
    await this.raiseEvent(systemId, systemName, componentName, eventName, params);
  }

  // Update system state (for compatibility with Firebase service interface)
  static async updateSystemState(systemName: string, state: any): Promise<void> {
    // In simulation mode, state is managed by Java backend
    // This method exists for interface compatibility but doesn't need to do anything
    console.log(`Simulation state update for ${systemName}:`, state);
  }

  // Update component state (for compatibility with Firebase service interface)
  static async updateComponentState(systemName: string, componentName: string, state: any): Promise<void> {
    // In simulation mode, state is managed by Java backend
    // This method exists for interface compatibility but doesn't need to do anything
    console.log(`Simulation component state update for ${systemName}/${componentName}:`, state);
  }

  // Subscribe methods (for compatibility - in simulation mode, we poll or use websockets)
  static subscribeToSystemState(systemName: string, callback: (data: any) => void): () => void {
    // For now, return empty unsubscribe function
    // In a real implementation, this could use WebSockets or polling
    console.log(`Subscribing to system state for ${systemName}`);
    return () => {};
  }

  static subscribeToComponentState(systemName: string, componentName: string, callback: (data: any) => void): () => void {
    // For now, return empty unsubscribe function
    // In a real implementation, this could use WebSockets or polling
    console.log(`Subscribing to component state for ${systemName}/${componentName}`);
    return () => {};
  }
}

export default SimulationService;

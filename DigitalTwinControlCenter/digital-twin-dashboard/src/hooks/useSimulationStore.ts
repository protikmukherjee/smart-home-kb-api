import { useState, useEffect, useCallback } from 'react';
import SimulationService from '@/lib/simulationService';
import { getSimulationConfig } from '@/config/simulationConfig';

// Global simulation state store
interface SimulationState {
  systems: Record<string, {
    systemId: string;
    isRunning: boolean;
    state: any;
    components: Record<string, any>;
    lastUpdated: number;
  }>;
  isInitialized: boolean;
  error: string | null;
}

// Global state
let globalSimulationState: SimulationState = {
  systems: {},
  isInitialized: false,
  error: null
};

// Subscribers for state changes
const subscribers = new Set<(state: SimulationState) => void>();

// Notify all subscribers of state changes
function notifySubscribers() {
  subscribers.forEach(callback => callback(globalSimulationState));
}

// Update global state
function updateGlobalState(updater: (state: SimulationState) => SimulationState) {
  console.log(`SimulationStore: updateGlobalState called. Current state:`, globalSimulationState);
  const newState = updater(globalSimulationState);
  globalSimulationState = newState;
  console.log(`SimulationStore: updateGlobalState completed. New state:`, globalSimulationState);
  notifySubscribers();
}

// Helper function to extract component properties from system state
function extractComponentProperties(systemState: any): Record<string, any> {
  // The Java API already returns components in the correct format
  console.log(`SimulationStore: extractComponentProperties called with:`, systemState);
  const components = systemState.components || {};
  console.log(`SimulationStore: extracted components:`, components);
  return components;
}

// Simulation store hook
export function useSimulationStore() {
  const [state, setState] = useState<SimulationState>(globalSimulationState);

  // Temporarily disable WebSocket to debug system creation issue
  // const { isConnected } = useWebSocket({
  //   autoConnect: true,
  //   onSystemStateUpdate: (update) => {
  //     console.log('Received WebSocket update:', update);
  //
  //     // Extract system name from systemId (format: SystemName_timestamp)
  //     const systemName = update.systemId.split('_')[0];
  //
  //     if (update.type === 'STATE_UPDATE' && globalSimulationState.systems[systemName]) {
  //       // Update the global state with real-time data
  //       updateGlobalState(state => ({
  //         ...state,
  //         systems: {
  //           ...state.systems,
  //           [systemName]: {
  //             ...state.systems[systemName],
  //             state: update.data,
  //             components: update.data.components || {},
  //             lastUpdated: Date.now()
  //           }
  //         }
  //       }));
  //     }
  //   },
  //   onConnect: () => {
  //     console.log('WebSocket connected for simulation updates');
  //   },
  //   onError: (error) => {
  //     console.error('WebSocket error in simulation store:', error);
  //   }
  // });
  // WebSocket temporarily disabled for debugging

  // Subscribe to global state changes
  useEffect(() => {
    const callback = (newState: SimulationState) => setState(newState);
    subscribers.add(callback);
    
    return () => {
      subscribers.delete(callback);
    };
  }, []);

  // Initialize simulation service
  const initialize = useCallback(async () => {
    console.log(`SimulationStore: Initialize called. Current state:`, globalSimulationState);

    if (globalSimulationState.isInitialized) {
      console.log(`SimulationStore: Already initialized, returning`);
      return;
    }

    try {
      console.log(`SimulationStore: Getting simulation config`);
      const config = getSimulationConfig();
      console.log(`SimulationStore: Simulation config:`, config);

      console.log(`SimulationStore: Initializing SimulationService`);
      SimulationService.initialize(config);

      // Try to initialize all systems on the backend
      try {
        console.log(`SimulationStore: Initializing all systems on backend`);
        await SimulationService.initializeAllSystems();
        console.log(`SimulationStore: Backend systems initialized successfully`);
      } catch (error) {
        console.warn(`SimulationStore: Backend initialization failed, will create systems individually:`, error);
      }

      // Load existing systems from backend
      await loadExistingSystems();

      console.log(`SimulationStore: Updating global state to mark as initialized`);
      updateGlobalState(state => ({
        ...state,
        isInitialized: true,
        error: null
      }));

      console.log('SimulationStore: Simulation store initialized successfully');
    } catch (error) {
      console.error(`SimulationStore: Error initializing:`, error);
      updateGlobalState(state => ({
        ...state,
        error: error instanceof Error ? error.message : 'Failed to initialize simulation'
      }));
    }
  }, []);

  // Load existing systems from backend
  const loadExistingSystems = useCallback(async () => {
    try {
      console.log(`SimulationStore: Loading existing systems from backend`);
      const allSystems = await SimulationService.getAllSystems();
      console.log(`SimulationStore: Retrieved systems from backend:`, allSystems);

      if (allSystems && typeof allSystems === 'object') {
        const systemsToAdd: Record<string, any> = {};

        for (const [systemId, systemState] of Object.entries(allSystems)) {
          // Extract system name from systemId (e.g., "SmartGarageDoorSystem_1" -> "SmartGarageDoorSystem")
          const systemName = systemId.replace(/_\d+$/, '');

          console.log(`SimulationStore: Processing system ${systemId} -> ${systemName}`);

          const components = extractComponentProperties(systemState);

          systemsToAdd[systemName] = {
            systemId,
            isRunning: true,
            state: systemState,
            components,
            lastUpdated: Date.now()
          };
        }

        if (Object.keys(systemsToAdd).length > 0) {
          updateGlobalState(state => ({
            ...state,
            systems: {
              ...state.systems,
              ...systemsToAdd
            }
          }));

          console.log(`SimulationStore: Loaded ${Object.keys(systemsToAdd).length} existing systems:`, Object.keys(systemsToAdd));
        }
      }
    } catch (error) {
      console.warn(`SimulationStore: Could not load existing systems:`, error);
      // Don't throw error, just continue - systems can be created individually
    }
  }, []);

  // Create and start a system
  const createSystem = useCallback(async (systemName: string) => {
    console.log(`SimulationStore: Creating system ${systemName}`);
    console.log(`SimulationStore: Current global state before creation:`, globalSimulationState);

    if (!globalSimulationState.isInitialized) {
      console.log(`SimulationStore: Initializing simulation store first`);
      await initialize();
      console.log(`SimulationStore: After initialization:`, globalSimulationState);
    }

    // Check if system already exists in our store
    const existingSystem = globalSimulationState.systems[systemName];
    if (existingSystem) {
      console.log(`SimulationStore: System ${systemName} already exists with ID: ${existingSystem.systemId}`);
      return {
        systemId: existingSystem.systemId,
        systemData: existingSystem
      };
    }

    try {
      console.log(`SimulationStore: Calling SimulationService.createSystem for ${systemName}`);
      const systemId = await SimulationService.createSystem(systemName);
      console.log(`SimulationStore: System created with ID: ${systemId}`);

      console.log(`SimulationStore: Starting system ${systemId}`);
      await SimulationService.startSystem(systemId, systemName);

      console.log(`SimulationStore: Adding system ${systemName} to global state`);
      updateGlobalState(state => ({
        ...state,
        systems: {
          ...state.systems,
          [systemName]: {
            systemId,
            isRunning: true,
            state: {},
            components: {},
            lastUpdated: Date.now()
          }
        }
      }));

      console.log(`SimulationStore: System ${systemName} added to state. Current systems:`, Object.keys(globalSimulationState.systems));

      // Get initial system state and properties
      try {
        const systemState = await SimulationService.getSystemState(systemId, systemName);
        const initialComponents = extractComponentProperties(systemState);

        updateGlobalState(state => ({
          ...state,
          systems: {
            ...state.systems,
            [systemName]: {
              ...state.systems[systemName],
              state: systemState,
              components: initialComponents,
              lastUpdated: Date.now()
            }
          }
        }));
      } catch (error) {
        console.error(`Error getting initial state for ${systemName}:`, error);
      }

      console.log(`SimulationStore: System ${systemName} created and started with ID: ${systemId}`);
      console.log(`SimulationStore: Current systems in store:`, Object.keys(globalSimulationState.systems));

      // Return the created system data
      return {
        systemId,
        systemData: globalSimulationState.systems[systemName]
      };
    } catch (error) {
      console.error(`SimulationStore: Error creating system ${systemName}:`, error);
      console.error(`SimulationStore: Error details:`, error);

      updateGlobalState(state => ({
        ...state,
        error: error instanceof Error ? error.message : `Failed to create system ${systemName}`
      }));

      throw error;
    }
  }, [initialize]);

  // Stop a system
  const stopSystem = useCallback(async (systemName: string) => {
    const system = globalSimulationState.systems[systemName];
    if (!system) return;

    try {
      await SimulationService.stopSystem(system.systemId, systemName);
      
      updateGlobalState(state => ({
        ...state,
        systems: {
          ...state.systems,
          [systemName]: {
            ...state.systems[systemName],
            isRunning: false
          }
        }
      }));

      console.log(`System ${systemName} stopped`);
    } catch (error) {
      console.error(`Error stopping system ${systemName}:`, error);
    }
  }, []);

  // Execute action on a system
  const executeAction = useCallback(async (systemName: string, componentName: string, action: string, params?: any) => {
    console.log(`SimulationStore: executeAction called for ${systemName}/${componentName}/${action}`);
    console.log(`Available systems:`, Object.keys(globalSimulationState.systems));

    const system = globalSimulationState.systems[systemName];
    if (!system) {
      console.error(`System ${systemName} not found in simulation store. Current state:`, globalSimulationState);
      throw new Error(`System ${systemName} not found`);
    }

    try {
      // Handle special commands
      if (action === 'setSensorData') {
        // Set sensor environment data
        const { property, value } = params;
        await SimulationService.setEnvironmentData(system.systemId, systemName, componentName, { [property]: value });
        console.log(`Sensor data set for ${systemName}/${componentName}: ${property} = ${value}`);

        // Get updated system state without running cycle (user will run cycle manually)
        const systemState = await SimulationService.getSystemState(system.systemId, systemName);
        console.log("State: ", systemState);
        const updatedComponents = extractComponentProperties(systemState);

        updateGlobalState(state => ({
          ...state,
          systems: {
            ...state.systems,
            [systemName]: {
              ...state.systems[systemName],
              state: systemState,
              components: updatedComponents,
              lastUpdated: Date.now()
            }
          }
        }));

        return;
      }

      if (action === 'runCycle') {
        // Just run a cycle without any action
        await SimulationService.runCycle(system.systemId, systemName);
        console.log(`Cycle executed for ${systemName}`);

        // Get updated system state
        const systemState = await SimulationService.getSystemState(system.systemId, systemName);
        const updatedComponents = extractComponentProperties(systemState);

        updateGlobalState(state => ({
          ...state,
          systems: {
            ...state.systems,
            [systemName]: {
              ...state.systems[systemName],
              state: systemState,
              components: updatedComponents,
              lastUpdated: Date.now()
            }
          }
        }));

        return;
      }

      // Execute regular actions
      await SimulationService.executeAction(system.systemId, systemName, componentName, action, params);
      console.log(`Action ${action} executed on ${systemName}/${componentName}`);

      // Run a statechart cycle to process the action
      await SimulationService.runCycle(system.systemId, systemName);

      // Get updated system state
      const systemState = await SimulationService.getSystemState(system.systemId, systemName);

      // Get updated component properties
      const updatedComponents = extractComponentProperties(systemState);

      // Update the global state
      updateGlobalState(state => ({
        ...state,
        systems: {
          ...state.systems,
          [systemName]: {
            ...state.systems[systemName],
            state: systemState,
            components: updatedComponents,
            lastUpdated: Date.now()
          }
        }
      }));

    } catch (error) {
      console.error(`Error executing action ${action}:`, error);
      throw error;
    }
  }, []);

  // Set environment data for sensors
  const setEnvironmentData = useCallback(async (systemName: string, sensorName: string, data: any) => {
    const system = globalSimulationState.systems[systemName];
    if (!system) {
      throw new Error(`System ${systemName} not found`);
    }

    try {
      // Set the environment data
      await SimulationService.setEnvironmentData(system.systemId, systemName, sensorName, data);
      console.log(`Environment data set for ${systemName}/${sensorName}:`, data);

      // Run a statechart cycle to process the sensor data
      await SimulationService.runCycle(system.systemId, systemName);

      // Get updated system state
      const systemState = await SimulationService.getSystemState(system.systemId, systemName);

      // Get updated component properties
      const updatedComponents = extractComponentProperties(systemState);

      // Update the global state
      updateGlobalState(state => ({
        ...state,
        systems: {
          ...state.systems,
          [systemName]: {
            ...state.systems[systemName],
            state: systemState,
            components: updatedComponents,
            lastUpdated: Date.now()
          }
        }
      }));

    } catch (error) {
      console.error(`Error setting environment data:`, error);
      throw error;
    }
  }, []);

  // Manual refresh system state (for when user wants to check current state)
  const refreshSystemState = useCallback(async (systemName: string) => {
    const system = globalSimulationState.systems[systemName];
    if (!system) {
      throw new Error(`System ${systemName} not found`);
    }

    try {
      // Get current system state without running a cycle
      const systemState = await SimulationService.getSystemState(system.systemId, systemName);

      // Extract component properties from the system state
      const updatedComponents = extractComponentProperties(systemState);

      updateGlobalState(state => ({
        ...state,
        systems: {
          ...state.systems,
          [systemName]: {
            ...state.systems[systemName],
            state: systemState,
            components: updatedComponents,
            lastUpdated: Date.now()
          }
        }
      }));
    } catch (error) {
      console.error(`Error refreshing system state for ${systemName}:`, error);
      throw error;
    }
  }, []);

  // Refresh all systems from backend
  const refreshAllSystems = useCallback(async () => {
    try {
      console.log(`SimulationStore: Refreshing all systems from backend`);
      await loadExistingSystems();
      console.log(`SimulationStore: All systems refreshed successfully`);
    } catch (error) {
      console.error(`SimulationStore: Error refreshing all systems:`, error);
      throw error;
    }
  }, [loadExistingSystems]);

  // Clear error
  const clearError = useCallback(() => {
    updateGlobalState(state => ({
      ...state,
      error: null
    }));
  }, []);

  return {
    state,
    initialize,
    createSystem,
    stopSystem,
    executeAction,
    setEnvironmentData,
    refreshSystemState,
    refreshAllSystems,
    clearError
  };
}

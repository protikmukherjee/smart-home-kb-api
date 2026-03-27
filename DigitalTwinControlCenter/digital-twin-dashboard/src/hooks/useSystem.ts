import { useState, useEffect, useCallback } from 'react';
import type { SystemDefinition } from '@/config/systemConfig';
import SystemService from '@/lib/systemService';
import { useSimulationStore } from '@/hooks/useSimulationStore';

interface UseSystemProps {
  systemName: string;
  mode: 'real' | 'simulated';
  systemDefinition: SystemDefinition;
}

interface SystemState {
  isOn: boolean;
  components: Record<string, any>;
  lastUpdated?: number;
  isLoading: boolean;
  error: string | null;
}

export function useSystem({ systemName, mode, systemDefinition }: UseSystemProps) {
  const [systemState, setSystemState] = useState<SystemState>({
    isOn: false,
    components: {},
    isLoading: true,
    error: null
  });

  const simulationStore = useSimulationStore();

  // Initialize system based on mode with real-time listeners
  useEffect(() => {
    if (!systemDefinition) {
      setSystemState(prev => ({
        ...prev,
        isLoading: false,
        error: `System definition not found for: ${systemName}`
      }));
      return;
    }

    let unsubscribeFunctions: (() => void)[] = [];

    const initializeSystem = async () => {
      console.log(`useSystem: initializeSystem called for ${systemName} in ${mode} mode`);

      try {
        setSystemState(prev => ({ ...prev, isLoading: true, error: null }));

        console.log(`useSystem: Initializing SystemService for ${mode} mode`);
        // Initialize the system service with the current mode
        await SystemService.initialize(mode);

        if (mode === 'simulated') {
          // Initialize simulation store if not already done
          if (!simulationStore.state.isInitialized) {
            await simulationStore.initialize();
          }

          // Check if system already exists in simulation store
          let simSystem = simulationStore.state.systems[systemName];

          if (!simSystem) {
            console.log(`Creating new simulation system: ${systemName}`);
            const result = await simulationStore.createSystem(systemName);
            console.log(`System creation result:`, result);

            // Use the returned system data directly
            simSystem = result.systemData;
          } else {
            console.log(`Using existing simulation system: ${systemName}`);
          }

          if (simSystem) {
            console.log(`System ${systemName} found in simulation store:`, simSystem);
            setSystemState({
              isOn: simSystem.isRunning,
              components: simSystem.components,
              lastUpdated: simSystem.lastUpdated,
              isLoading: false,
              error: null
            });
          } else {
            console.error(`System ${systemName} not found in simulation store after creation and retries`);
            console.error(`Available systems:`, Object.keys(simulationStore.state.systems));
            setSystemState(prev => ({
              ...prev,
              isLoading: false,
              error: `Failed to initialize system ${systemName}`
            }));
          }
        } else {
          // Real mode - set up real-time listeners for Firebase
          try {
            // Subscribe to system state changes
            const systemUnsubscribe = SystemService.subscribeToSystemState(systemName, (systemData) => {
              console.log(`useSystem: System state update for ${systemName}:`, systemData);
              setSystemState(prev => ({
                ...prev,
                isOn: systemData?.isOn !== undefined ? systemData.isOn : prev.isOn,
                lastUpdated: systemData?.lastUpdated || Date.now()
              }));
            });
            unsubscribeFunctions.push(systemUnsubscribe);

            // Subscribe to each component's state changes
            for (const component of systemDefinition.components) {
              const componentUnsubscribe = SystemService.subscribeToComponentState(
                systemName,
                component.name,
                (componentData) => {
                  console.log(`useSystem: Component state update for ${systemName}/${component.name}:`, componentData);
                  setSystemState(prev => ({
                    ...prev,
                    components: {
                      ...prev.components,
                      [component.name]: componentData || component.properties
                    },
                    lastUpdated: Date.now()
                  }));
                }
              );
              unsubscribeFunctions.push(componentUnsubscribe);
            }

            // Set initial loading state to false after setting up listeners
            setSystemState(prev => ({
              ...prev,
              isLoading: false,
              error: null
            }));

          } catch (error) {
            console.error(`Failed to initialize real system ${systemName}:`, error);
            setSystemState(prev => ({
              ...prev,
              isLoading: false,
              error: `Failed to connect to real system: ${error instanceof Error ? error.message : 'Unknown error'}`
            }));
          }
        }
      } catch (error) {
        console.error('Error initializing system:', error);
        setSystemState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    };

    console.log(`useSystem: useEffect triggered for ${systemName} in ${mode} mode`);
    initializeSystem();

    // Cleanup function to unsubscribe from all listeners
    return () => {
      console.log(`useSystem: Cleaning up for ${systemName}`);
      unsubscribeFunctions.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('Error unsubscribing from listener:', error);
        }
      });
    };
  }, [systemName, mode, systemDefinition]);

  // Update system state from simulation store when it changes
  useEffect(() => {
    if (mode === 'simulated' && simulationStore.state.systems[systemName]) {
      const simSystem = simulationStore.state.systems[systemName];
      setSystemState(prev => ({
        ...prev,
        isOn: simSystem.isRunning,
        components: simSystem.components,
        lastUpdated: simSystem.lastUpdated,
        error: simulationStore.state.error
      }));
    }
  }, [mode, systemName, simulationStore.state]);

  // Execute command on component
  const executeCommand = useCallback(async (componentName: string, command: string, params?: any) => {
    try {
      console.log(`Executing command: ${command} on ${systemName}/${componentName} in ${mode} mode`);

      if (mode === 'simulated') {
        // Check if system exists before executing action
        const hasSystem = simulationStore.state.systems[systemName];
        if (!hasSystem) {
          console.error(`System ${systemName} not found in simulation store. Available systems:`, Object.keys(simulationStore.state.systems));
          throw new Error(`System ${systemName} not found. Please refresh the page and try again.`);
        }

        await simulationStore.executeAction(systemName, componentName, command, params);
      } else {
        await SystemService.executeAction(systemName, componentName, command, params);
      }
    } catch (error) {
      console.error('Error executing command:', error);
      setSystemState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to execute command'
      }));
    }
  }, [mode, simulationStore, systemName]);

  // Get component state
  const getComponentState = useCallback((componentName: string) => {
    const componentState = systemState.components[componentName] || {};
    console.log(`useSystem: getComponentState for ${componentName}:`, componentState);
    console.log(`useSystem: Available components:`, Object.keys(systemState.components));
    return componentState;
  }, [systemState.components]);

  // Clear error
  const clearError = useCallback(() => {
    setSystemState(prev => ({ ...prev, error: null }));
    if (mode === 'simulated') {
      simulationStore.clearError();
    }
  }, [mode, simulationStore]);

  return {
    systemState: {
      isOn: systemState.isOn,
      components: systemState.components,
      lastUpdated: systemState.lastUpdated
    },
    isLoading: systemState.isLoading,
    error: systemState.error,
    executeCommand,
    getComponentState,
    clearError,
    systemDefinition
  };
}

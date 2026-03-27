// Simulation URL configuration for Java API endpoints
export interface SimulationEndpointConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description?: string;
}

export interface SimulationActionConfig {
  endpoint: string;
  method: 'POST';
  componentName: string;
  eventName: string;
  description?: string;
}

export interface SimulationPropertyConfig {
  dataType: 'boolean' | 'number' | 'string' | 'object';
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description?: string;
}

export interface SimulationSensorConfig {
  endpoint: string;
  method: 'POST';
  sensorType: string;
  description?: string;
}

export interface SystemSimulationConfig {
  systemName: string;
  systemType: string; // Java system type
  baseEndpoint: string;
  endpoints: {
    create: SimulationEndpointConfig;
    start: SimulationEndpointConfig;
    stop: SimulationEndpointConfig;
    delete: SimulationEndpointConfig;
    getState: SimulationEndpointConfig;
    runCycle: SimulationEndpointConfig;
    raiseEvent: SimulationEndpointConfig;
    setEnvironmentData: SimulationEndpointConfig;
  };
  properties: Record<string, Record<string, SimulationPropertyConfig>>; // Component properties
  actions: Record<string, Record<string, SimulationActionConfig>>; // Component actions
  sensors: Record<string, SimulationSensorConfig>; // Sensor configurations
}

// Simulation URL configurations for each system
export const SIMULATION_URL_CONFIGS: Record<string, SystemSimulationConfig> = {
  SmartGarageDoorSystem: {
    systemName: 'SmartGarageDoorSystem',
    systemType: 'SmartGarageDoorSystem',
    baseEndpoint: '/api/statechart/systems',
    endpoints: {
      create: {
        endpoint: '/api/statechart/systems/{systemId}?systemType=SmartGarageDoorSystem',
        method: 'POST',
        description: 'Create a new garage door system instance'
      },
      start: {
        endpoint: '/api/statechart/systems/{systemId}/start',
        method: 'POST',
        description: 'Start the garage door system'
      },
      stop: {
        endpoint: '/api/statechart/systems/{systemId}/stop',
        method: 'POST',
        description: 'Stop the garage door system'
      },
      delete: {
        endpoint: '/api/statechart/systems/{systemId}',
        method: 'DELETE',
        description: 'Delete the garage door system'
      },
      getState: {
        endpoint: '/api/statechart/systems/{systemId}/state',
        method: 'GET',
        description: 'Get current system state'
      },
      runCycle: {
        endpoint: '/api/statechart/systems/{systemId}/runCycle',
        method: 'POST',
        description: 'Execute one statechart cycle'
      },
      raiseEvent: {
        endpoint: '/api/statechart/systems/{systemId}/raiseEvent',
        method: 'POST',
        description: 'Raise an event on a component'
      },
      setEnvironmentData: {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData',
        method: 'POST',
        description: 'Set environment data for sensors'
      }
    },
    properties: {
      'GarageDoor_Unit': {
        'door_status': {
          dataType: 'boolean',
          description: 'Garage door open/closed status'
        },
        'block': {
          dataType: 'boolean',
          description: 'Whether the door is blocked by an obstacle'
        },
        'isOn': {
          dataType: 'boolean',
          description: 'Garage door system power status'
        },
        'door_closed': {
          dataType: 'boolean',
          description: 'Whether the door is closed'
        },
        'current_open_time': {
          dataType: 'number',
          description: 'Current time the door has been open'
        }
      },
      'UltraSonic_Sensor': {
        'activity': {
          dataType: 'boolean',
          description: 'Sensor activity status'
        },
        'environmentData': {
          dataType: 'object',
          description: 'Environment data from ultrasonic sensor'
        }
      },
      'Power_Component': {
        'isOn': {
          dataType: 'boolean',
          description: 'Power component status'
        },
        'kWh': {
          dataType: 'number',
          description: 'Power consumption in kWh'
        }
      }
    },
    actions: {
      'GarageDoor_Unit': {
        'raiseOpen_door': {
          endpoint: '/api/statechart/systems/{systemId}/raiseEvent?componentName=GarageDoor_Unit&eventName=raiseOpen_door',
          method: 'POST',
          componentName: 'GarageDoor_Unit',
          eventName: 'raiseOpen_door',
          description: 'Command to open the garage door'
        },
        'raiseClose_door': {
          endpoint: '/api/statechart/systems/{systemId}/raiseEvent?componentName=GarageDoor_Unit&eventName=raiseClose_door',
          method: 'POST',
          componentName: 'GarageDoor_Unit',
          eventName: 'raiseClose_door',
          description: 'Command to close the garage door'
        }
      }
    },
    sensors: {
      'ultrasonic': {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData?sensorType=ultrasonic&value={value}',
        method: 'POST',
        sensorType: 'ultrasonic',
        description: 'Set ultrasonic sensor distance value'
      },
      'motion': {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData?sensorType=motion&value={value}',
        method: 'POST',
        sensorType: 'motion',
        description: 'Set motion sensor detection value'
      }
    }
  },

  SmartLightSystem: {
    systemName: 'SmartLightSystem',
    systemType: 'SmartLightSystem',
    baseEndpoint: '/api/statechart/systems',
    endpoints: {
      create: {
        endpoint: '/api/statechart/systems/{systemId}?systemType=SmartLightSystem',
        method: 'POST',
        description: 'Create a new light system instance'
      },
      start: {
        endpoint: '/api/statechart/systems/{systemId}/start',
        method: 'POST',
        description: 'Start the light system'
      },
      stop: {
        endpoint: '/api/statechart/systems/{systemId}/stop',
        method: 'POST',
        description: 'Stop the light system'
      },
      delete: {
        endpoint: '/api/statechart/systems/{systemId}',
        method: 'DELETE',
        description: 'Delete the light system'
      },
      getState: {
        endpoint: '/api/statechart/systems/{systemId}/state',
        method: 'GET',
        description: 'Get current system state'
      },
      runCycle: {
        endpoint: '/api/statechart/systems/{systemId}/runCycle',
        method: 'POST',
        description: 'Execute one statechart cycle'
      },
      raiseEvent: {
        endpoint: '/api/statechart/systems/{systemId}/raiseEvent',
        method: 'POST',
        description: 'Raise an event on a component'
      },
      setEnvironmentData: {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData',
        method: 'POST',
        description: 'Set environment data for sensors'
      }
    },
    properties: {
      'LEDLight_Unit': {
        'isOn': {
          dataType: 'boolean',
          description: 'Light on/off status'
        },
        'brightness': {
          dataType: 'number',
          description: 'Light brightness level'
        }
      },
      'Motion_Sensor': {
        'activity': {
          dataType: 'boolean',
          description: 'Motion sensor activity status'
        },
        'environmentData': {
          dataType: 'object',
          description: 'Environment data from motion sensor'
        }
      }
    },
    actions: {
      'LEDLight_Unit': {
        'raiseTurn_on': {
          endpoint: '/api/statechart/systems/{systemId}/raiseEvent?componentName=LEDLight_Unit&eventName=raiseTurn_on',
          method: 'POST',
          componentName: 'LEDLight_Unit',
          eventName: 'raiseTurn_on',
          description: 'Command to turn on the LED light'
        },
        'raiseTurn_off': {
          endpoint: '/api/statechart/systems/{systemId}/raiseEvent?componentName=LEDLight_Unit&eventName=raiseTurn_off',
          method: 'POST',
          componentName: 'LEDLight_Unit',
          eventName: 'raiseTurn_off',
          description: 'Command to turn off the LED light'
        }
      }
    },
    sensors: {
      'motion': {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData?sensorType=motion&value={value}',
        method: 'POST',
        sensorType: 'motion',
        description: 'Set motion sensor detection value'
      },
      'brightness': {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData?sensorType=brightness&value={value}',
        method: 'POST',
        sensorType: 'brightness',
        description: 'Set brightness sensor ambient light value'
      }
    }
  },

  SmartFireSystem: {
    systemName: 'SmartFireSystem',
    systemType: 'SmartFireSystem',
    baseEndpoint: '/api/statechart/systems',
    endpoints: {
      create: {
        endpoint: '/api/statechart/systems/{systemId}?systemType=SmartFireSystem',
        method: 'POST',
        description: 'Create a new fire system instance'
      },
      start: {
        endpoint: '/api/statechart/systems/{systemId}/start',
        method: 'POST',
        description: 'Start the fire system'
      },
      stop: {
        endpoint: '/api/statechart/systems/{systemId}/stop',
        method: 'POST',
        description: 'Stop the fire system'
      },
      delete: {
        endpoint: '/api/statechart/systems/{systemId}',
        method: 'DELETE',
        description: 'Delete the fire system'
      },
      getState: {
        endpoint: '/api/statechart/systems/{systemId}/state',
        method: 'GET',
        description: 'Get current system state'
      },
      runCycle: {
        endpoint: '/api/statechart/systems/{systemId}/runCycle',
        method: 'POST',
        description: 'Execute one statechart cycle'
      },
      raiseEvent: {
        endpoint: '/api/statechart/systems/{systemId}/raiseEvent',
        method: 'POST',
        description: 'Raise an event on a component'
      },
      setEnvironmentData: {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData',
        method: 'POST',
        description: 'Set environment data for sensors'
      }
    },
    properties: {
      'FireAlarm_Unit': {
        'activated': {
          dataType: 'boolean',
          description: 'Fire alarm activation status'
        },
        'threshold_reached': {
          dataType: 'boolean',
          description: 'Whether alarm threshold has been reached'
        }
      },
      'Smoke_Sensor': {
        'environmentData': {
          dataType: 'object',
          description: 'Environment data from smoke sensor'
        },
        'threshold': {
          dataType: 'number',
          description: 'Smoke detection threshold'
        }
      },
      'Heat_Sensor': {
        'environmentData': {
          dataType: 'object',
          description: 'Environment data from heat sensor'
        },
        'threshold': {
          dataType: 'number',
          description: 'Heat detection threshold'
        }
      },
      'Flame_Sensor': {
        'environmentData': {
          dataType: 'object',
          description: 'Environment data from flame sensor'
        },
        'threshold': {
          dataType: 'number',
          description: 'Flame detection threshold'
        }
      }
    },
    actions: {
      'Alarm_Unit': {
        'raisePause': {
          endpoint: '/api/statechart/systems/{systemId}/raiseEvent?componentName=Alarm_Unit&eventName=raisePause',
          method: 'POST',
          componentName: 'Alarm_Unit',
          eventName: 'raisePause',
          description: 'Command to pause the fire alarm'
        },
        'raiseResume': {
          endpoint: '/api/statechart/systems/{systemId}/raiseEvent?componentName=Alarm_Unit&eventName=raiseResume',
          method: 'POST',
          componentName: 'Alarm_Unit',
          eventName: 'raiseResume',
          description: 'Command to resume the fire alarm'
        }
      }
    },
    sensors: {
      'Smoke_Sensor': {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData?sensorType=smoke&value={value}',
        method: 'POST',
        sensorType: 'smoke',
        description: 'Set smoke sensor detection value'
      },
      'Heat_Sensor': {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData?sensorType=temperature&value={value}',
        method: 'POST',
        sensorType: 'temperature',
        description: 'Set temperature sensor value'
      },
      'Flame_Sensor': {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData?sensorType=flame&value={value}',
        method: 'POST',
        sensorType: 'flame',
        description: 'Set flame sensor detection value'
      }
    }
  },

  SmartMicrowaveSystem: {
    systemName: 'SmartMicrowaveSystem',
    systemType: 'SmartMicrowaveSystem',
    baseEndpoint: '/api/statechart/systems',
    endpoints: {
      create: {
        endpoint: '/api/statechart/systems/{systemId}?systemType=SmartMicrowaveSystem',
        method: 'POST',
        description: 'Create a new microwave system instance'
      },
      start: {
        endpoint: '/api/statechart/systems/{systemId}/start',
        method: 'POST',
        description: 'Start the microwave system'
      },
      stop: {
        endpoint: '/api/statechart/systems/{systemId}/stop',
        method: 'POST',
        description: 'Stop the microwave system'
      },
      delete: {
        endpoint: '/api/statechart/systems/{systemId}',
        method: 'DELETE',
        description: 'Delete the microwave system'
      },
      getState: {
        endpoint: '/api/statechart/systems/{systemId}/state',
        method: 'GET',
        description: 'Get current system state'
      },
      runCycle: {
        endpoint: '/api/statechart/systems/{systemId}/runCycle',
        method: 'POST',
        description: 'Execute one statechart cycle'
      },
      raiseEvent: {
        endpoint: '/api/statechart/systems/{systemId}/raiseEvent',
        method: 'POST',
        description: 'Raise an event on a component'
      },
      setEnvironmentData: {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData',
        method: 'POST',
        description: 'Set environment data for sensors'
      }
    },
    properties: {
      'Microwave_Unit': {
        'isOn': {
          dataType: 'boolean',
          description: 'Microwave power status'
        },
        'timer': {
          dataType: 'number',
          description: 'Timer setting in seconds'
        },
        'in_use': {
          dataType: 'boolean',
          description: 'Whether microwave is currently in use'
        }
      }
    },
    actions: {
      'Microwave_Unit': {
        'raiseTurnOn': {
          endpoint: '/api/statechart/systems/{systemId}/raiseEvent?componentName=Microwave_Unit&eventName=raiseTurnOn',
          method: 'POST',
          componentName: 'Microwave_Unit',
          eventName: 'raiseTurnOn',
          description: 'Command to turn on the microwave'
        },
        'raiseTurnOff': {
          endpoint: '/api/statechart/systems/{systemId}/raiseEvent?componentName=Microwave_Unit&eventName=raiseTurnOff',
          method: 'POST',
          componentName: 'Microwave_Unit',
          eventName: 'raiseTurnOff',
          description: 'Command to turn off the microwave'
        },
        'raiseSetTimer': {
          endpoint: '/api/statechart/systems/{systemId}/raiseEvent?componentName=Microwave_Unit&eventName=raiseSetTimer',
          method: 'POST',
          componentName: 'Microwave_Unit',
          eventName: 'raiseSetTimer',
          description: 'Command to set microwave timer'
        }
      }
    },
    sensors: {
      'door': {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData?sensorType=door&value={value}',
        method: 'POST',
        sensorType: 'door',
        description: 'Set door sensor open/closed value'
      }
    }
  },

  SmartTrafficLightSystem: {
    systemName: 'SmartTrafficLightSystem',
    systemType: 'SmartTrafficLightSystem',
    baseEndpoint: '/api/statechart/systems',
    endpoints: {
      create: {
        endpoint: '/api/statechart/systems/{systemId}?systemType=SmartTrafficLightSystem',
        method: 'POST',
        description: 'Create a new traffic light system instance'
      },
      start: {
        endpoint: '/api/statechart/systems/{systemId}/start',
        method: 'POST',
        description: 'Start the traffic light system'
      },
      stop: {
        endpoint: '/api/statechart/systems/{systemId}/stop',
        method: 'POST',
        description: 'Stop the traffic light system'
      },
      delete: {
        endpoint: '/api/statechart/systems/{systemId}',
        method: 'DELETE',
        description: 'Delete the traffic light system'
      },
      getState: {
        endpoint: '/api/statechart/systems/{systemId}/state',
        method: 'GET',
        description: 'Get current system state'
      },
      runCycle: {
        endpoint: '/api/statechart/systems/{systemId}/runCycle',
        method: 'POST',
        description: 'Execute one statechart cycle'
      },
      raiseEvent: {
        endpoint: '/api/statechart/systems/{systemId}/raiseEvent',
        method: 'POST',
        description: 'Raise an event on a component'
      },
      setEnvironmentData: {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData',
        method: 'POST',
        description: 'Set environment data for sensors'
      }
    },
    properties: {
      'TrafficLight_Unit': {
        'current_light': {
          endpoint: '/api/statechart/systems/{systemId}/components/TrafficLight_Unit/properties/current_light',
          method: 'GET',
          dataType: 'string',
          description: 'Current traffic light state (red/yellow/green)'
        },
        'timer': {
          endpoint: '/api/statechart/systems/{systemId}/components/TrafficLight_Unit/properties/timer',
          method: 'GET',
          dataType: 'number',
          description: 'Time remaining for current light'
        }
      },
      'Vehicle_Sensor': {
        'vehicle_detected': {
          endpoint: '/api/statechart/systems/{systemId}/components/Vehicle_Sensor/properties/vehicle_detected',
          method: 'GET',
          dataType: 'boolean',
          description: 'Vehicle detection status'
        }
      }
    },
    actions: {
      'TrafficLight_Unit': {
        'raiseChangeLight': {
          endpoint: '/api/statechart/systems/{systemId}/raiseEvent?componentName=TrafficLight_Unit&eventName=raiseChangeLight',
          method: 'POST',
          componentName: 'TrafficLight_Unit',
          eventName: 'raiseChangeLight',
          description: 'Command to change traffic light'
        }
      }
    },
    sensors: {
      'vehicle': {
        endpoint: '/api/statechart/systems/{systemId}/setEnvironmentData?sensorType=vehicle&value={value}',
        method: 'POST',
        sensorType: 'vehicle',
        description: 'Set vehicle sensor detection value'
      }
    }
  }
};

let runtimeSimulationConfigOverrides: Record<string, SystemSimulationConfig> = {};

export function setRuntimeSimulationConfigOverrides(
  overrides: Record<string, SystemSimulationConfig>
) {
  runtimeSimulationConfigOverrides = overrides;
}

// Helper functions
export function getSystemSimulationConfig(systemName: string): SystemSimulationConfig | undefined {
  if (runtimeSimulationConfigOverrides[systemName]) {
    return runtimeSimulationConfigOverrides[systemName];
  }
  return SIMULATION_URL_CONFIGS[systemName];
}

export function getSimulationEndpoint(systemName: string, endpointType: keyof SystemSimulationConfig['endpoints']): string | undefined {
  const config = getSystemSimulationConfig(systemName);
  return config?.endpoints[endpointType]?.endpoint;
}

export function getSimulationEndpointConfig(systemName: string, endpointType: keyof SystemSimulationConfig['endpoints']): SimulationEndpointConfig | undefined {
  const config = getSystemSimulationConfig(systemName);
  return config?.endpoints[endpointType];
}

export function getActionSimulationConfig(systemName: string, componentName: string, actionName: string): SimulationActionConfig | undefined {
  const config = getSystemSimulationConfig(systemName);
  return config?.actions[componentName]?.[actionName];
}

export function getActionEndpoint(systemName: string, componentName: string, actionName: string): string | undefined {
  const actionConfig = getActionSimulationConfig(systemName, componentName, actionName);
  return actionConfig?.endpoint;
}

export function getSensorSimulationConfig(systemName: string, sensorName: string): SimulationSensorConfig | undefined {
  const config = getSystemSimulationConfig(systemName);
  return config?.sensors[sensorName];
}

export function getSensorEndpoint(systemName: string, sensorName: string): string | undefined {
  const sensorConfig = getSensorSimulationConfig(systemName, sensorName);
  return sensorConfig?.endpoint;
}

export function getSystemType(systemName: string): string | undefined {
  const config = getSystemSimulationConfig(systemName);
  return config?.systemType;
}

// Utility function to replace placeholders in endpoints
export function buildEndpointUrl(endpoint: string, systemId: string, value?: any): string {
  let url = endpoint.replace('{systemId}', systemId);
  if (value !== undefined) {
    url = url.replace('{value}', encodeURIComponent(String(value)));
  }
  return url;
}

// Get all available actions for a system
export function getSystemActions(systemName: string): Record<string, Record<string, SimulationActionConfig>> {
  const config = getSystemSimulationConfig(systemName);
  return config?.actions || {};
}

// Get all available sensors for a system
export function getSystemSensors(systemName: string): Record<string, SimulationSensorConfig> {
  const config = getSystemSimulationConfig(systemName);
  return config?.sensors || {};
}

// Property-related helper functions
export function getPropertySimulationConfig(systemName: string, componentName: string, propertyName: string): SimulationPropertyConfig | undefined {
  const config = getSystemSimulationConfig(systemName);
  return config?.properties[componentName]?.[propertyName];
}

export function getPropertyEndpoint(systemName: string, componentName: string, propertyName: string): string | undefined {
  const propertyConfig = getPropertySimulationConfig(systemName, componentName, propertyName);
  return propertyConfig?.endpoint;
}

export function getPropertyDataType(systemName: string, componentName: string, propertyName: string): SimulationPropertyConfig['dataType'] | undefined {
  const propertyConfig = getPropertySimulationConfig(systemName, componentName, propertyName);
  return propertyConfig?.dataType;
}

// Get all available properties for a system
export function getSystemProperties(systemName: string): Record<string, Record<string, SimulationPropertyConfig>> {
  const config = getSystemSimulationConfig(systemName);
  return config?.properties || {};
}

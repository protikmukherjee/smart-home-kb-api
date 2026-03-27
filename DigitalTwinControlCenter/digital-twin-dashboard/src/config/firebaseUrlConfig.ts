// Firebase URL configuration for system properties
export interface PropertyConfig {
  firebaseUrl: string;
  dataType: 'boolean' | 'number' | 'string' | 'object';
  writable: boolean;
  description?: string;
}

export interface ActionConfig {
  firebaseUrl: string;
  dataType: 'boolean' | 'number' | 'string' | 'object';
  value: any; // The specific value this action should set
  description?: string;
}

export interface FaultConfig {
  faultUrl: string;
  dataType: 'boolean';
  description?: string;
}

export interface SystemFirebaseConfig {
  systemName: string;
  baseUrl: string;
  systemStateUrl: string; // URL for system-level state
  systemActionsUrl: string; // URL for system-level actions (deprecated - use actions instead)
  properties: Record<string, Record<string, PropertyConfig>>;
  actions: Record<string, Record<string, ActionConfig>>; // Component actions with their Firebase URLs
  faults?: Record<string, FaultConfig>; // Per-component fault mapping
}

// Firebase URL configurations for each system
// export const FIREBASE_URL_CONFIGS: Record<string, SystemFirebaseConfig> = {
export const FIREBASE_URL_CONFIGS: Record<string, SystemFirebaseConfig> = {
  SmartGarageDoorSystem: {
    systemName: 'SmartGarageDoorSystem',
    baseUrl: '/SmartHomeSystem/SmartGarageDoorSystem',
    systemStateUrl: '/SmartHomeSystem/SmartGarageDoorSystem/isOn',
    systemActionsUrl: '/SmartHomeSystem/SmartGarageDoorSystem',
    properties: {
      'GarageDoor_Unit': {
        'door_status': {
          firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/status_door',
          dataType: 'boolean',
          writable: true,
          description: 'Garage door open/closed status'
        },
        'block': {
          firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/door_blocked',
          dataType: 'boolean',
          writable: false,
          description: 'Whether the door is blocked by an obstacle'
        },
      },
      'UltraSonic_Sensor': {
        'distance': {
          firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/distance',
          dataType: 'number',
          writable: false,
          description: 'Distance measured by ultrasonic sensor'
        },
        'motion_detected': {
          firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/motion_detected',
          dataType: 'boolean',
          writable: false,
          description: 'Motion detection status'
        }
      },
      'Power_Component': {
        'power_total': {
          firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/power_mW',
          dataType: 'number',
          writable: false,
          description: 'Total power consumption in watts'
        }
      },
      'Network_Component': {
        'wiFi_connection': {
          firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/wifi_status',
          dataType: 'boolean',
          writable: false,
          description: 'WiFi connection status'
        }
      },
      'DeviceTemp_Component': {
        'temperature': {
          firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/temperature',
          dataType: 'number',
          writable: false,
          description: 'Device temperature in Celsius'
        }
      }
    },
    actions: {
      'GarageDoor_Unit': {
        'raiseOpen_door': {
          firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/status_door',
          dataType: 'boolean',
          value: true,
          description: 'Command to open the garage door'
        },
        'raiseClose_door': {
          firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/status_door',
          dataType: 'boolean',
          value: false,
          description: 'Command to close the garage door'
        }
      }
    }
  },

  SmartLightSystem: {
    systemName: 'SmartLightSystem',
    baseUrl: '/SmartHomeSystem/SmartLightSystem',
    systemStateUrl: '/SmartHomeSystem/SmartLightSystem/Light1_isOn',
    systemActionsUrl: '/SmartHomeSystem/SmartLightSystem',
    properties: {
      'LEDLight_Unit': {
        'isOn': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_status',
          dataType: 'boolean',
          writable: true,
          description: 'Light on/off status'
        }
      },
      'Motion_Sensor': {
        'motion_detected': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_motion_detected',
          dataType: 'boolean',
          writable: false,
          description: 'Motion detection status'
        }
      },
      'Brightness_Sensor': {
        'ambient_light': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_brightness',
          dataType: 'number',
          writable: false,
          description: 'Ambient light level'
        }
      },
      'Power_Component': {
        'power_total': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_power_mW',
          dataType: 'number',
          writable: false,
          description: 'Total power consumption in milliwatts'
        }
      },
      'Network_Component': {
        'wiFi_connection': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_wifi_status',
          dataType: 'boolean',
          writable: false,
          description: 'WiFi connection status'
        }
      }
    },
    actions: {
      'LEDLight_Unit': {
        'raiseTurn_on': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_status',
          dataType: 'boolean',
          value: true,
          description: 'Command to turn on the LED light'
        },
        'raiseTurn_off': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_status',
          dataType: 'boolean',
          value: false,
          description: 'Command to turn off the LED light'
        }
      }
    }
  },

  SmartFireSystem: {
    systemName: 'SmartFireSystem',
    baseUrl: '/SmartHomeSystem/SmartFireSystem',
    systemStateUrl: '/SmartHomeSystem/SmartFireSystem/status_system',
    systemActionsUrl: '/SmartHomeSystem/SmartFireSystem',
    properties: {
      'Smoke_Sensor': {
        'smoke_detected': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/Smoke',
          dataType: 'boolean',
          writable: false,
          description: 'Smoke detection status'
        }
      },
      'Heat_Sensor': {
        'temperature': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/Heat',
          dataType: 'number',
          writable: false,
          description: 'Temperature reading in Celsius'
        }
      },
      'Alarm_Unit': {
        'isActive': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/alarm_status',
          dataType: 'boolean',
          writable: true,
          description: 'Fire alarm active status'
        },
        'isPaused': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/pause',
          dataType: 'boolean',
          writable: true,
          description: 'Fire alarm pause status'
        }
      },
      'Flame_Sensor': {
        'flame_detected': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/Flame',
          dataType: 'boolean',
          writable: false,
          description: 'Flame detection status'
        }
      },
      'Humidity_Sensor': {
        'humidity': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/Humidity',
          dataType: 'number',
          writable: false,
          description: 'Humidity level percentage'
        }
      },
      'eCO2_Sensor': {
        'eCO2': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/eCO2',
          dataType: 'number',
          writable: false,
          description: 'eCO2 level in ppm'
        }
      },
      'Power_Component': {
        'power_total': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/power_mW',
          dataType: 'number',
          writable: false,
          description: 'Total power consumption in milliwatts'
        }
      },
      'Network_Component': {
        'wiFi_connection': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/wifi_status',
          dataType: 'boolean',
          writable: false,
          description: 'WiFi connection status'
        }
      },
      'DeviceTemp_Component': {
        'temperature': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/Heat',
          dataType: 'number',
          writable: false,
          description: 'Device temperature in Celsius'
        }
      }
    },
    actions: {
      'Alarm_Unit': {
        'raisePause': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/pause',
          dataType: 'boolean',
          value: true,
          description: 'Command to activate the fire alarm'
        },
        'raiseResume': {
          firebaseUrl: '/SmartHomeSystem/SmartFireSystem/pause',
          dataType: 'boolean',
          value: false,
          description: 'Command to deactivate the fire alarm'
        }
      }
    }
  },

  SmartMicrowaveSystem: {
    systemName: 'SmartMicrowaveSystem',
    baseUrl: '/SmartHomeSystem/SmartMicrowaveSystem',
    systemStateUrl: '/SmartHomeSystem/SmartMicrowaveSystem/system_state',
    systemActionsUrl: '/SmartHomeSystem/SmartMicrowaveSystem/system_actions',
    properties: {
      'Microwave_Unit': {
        'isOn': {
          firebaseUrl: '/SmartHomeSystem/SmartMicrowaveSystem/power_status',
          dataType: 'boolean',
          writable: true,
          description: 'Microwave power status'
        },
        'timer': {
          firebaseUrl: '/SmartHomeSystem/SmartMicrowaveSystem/timer_value',
          dataType: 'number',
          writable: true,
          description: 'Timer setting in seconds'
        },
        'power_level': {
          firebaseUrl: '/SmartHomeSystem/SmartMicrowaveSystem/power_level',
          dataType: 'number',
          writable: true,
          description: 'Power level setting (1-10)'
        }
      },
      'Door_Sensor': {
        'isOpen': {
          firebaseUrl: '/SmartHomeSystem/SmartMicrowaveSystem/door_status',
          dataType: 'boolean',
          writable: false,
          description: 'Microwave door open/closed status'
        }
      }
    },
    actions: {
      'Microwave_Unit': {
        'raiseTurnOn': {
          firebaseUrl: '/SmartHomeSystem/SmartMicrowaveSystem/power_status',
          dataType: 'boolean',
          value: true,
          description: 'Command to turn on the microwave'
        },
        'raiseTurnOff': {
          firebaseUrl: '/SmartHomeSystem/SmartMicrowaveSystem/power_status',
          dataType: 'boolean',
          value: false,
          description: 'Command to turn off the microwave'
        },
        'raiseSetTimer': {
          firebaseUrl: '/SmartHomeSystem/SmartMicrowaveSystem/timer_value',
          dataType: 'number',
          value: 60,
          description: 'Command to set microwave timer to 60 seconds'
        }
      }
    }
  },

  SmartTVSystem: {
    systemName: 'SmartTVSystem',
    baseUrl: '/SmartHomeSystem/SmartTVSystem',
    systemStateUrl: '/SmartHomeSystem/SmartTVSystem/system_state',
    systemActionsUrl: '/SmartHomeSystem/SmartTVSystem/system_actions',
    properties: {
      'TV_Unit': {
        'isOn': {
          firebaseUrl: '/SmartHomeSystem/SmartTVSystem/power_status',
          dataType: 'boolean',
          writable: true,
          description: 'TV power status'
        },
        'volume': {
          firebaseUrl: '/SmartHomeSystem/SmartTVSystem/volume_level',
          dataType: 'number',
          writable: true,
          description: 'TV volume level (0-100)'
        },
        'channel': {
          firebaseUrl: '/SmartHomeSystem/SmartTVSystem/current_channel',
          dataType: 'number',
          writable: true,
          description: 'Current TV channel'
        }
      },
      'Remote_Control': {
        'battery_level': {
          firebaseUrl: '/SmartHomeSystem/SmartTVSystem/remote_battery',
          dataType: 'number',
          writable: false,
          description: 'Remote control battery level'
        }
      }
    },
    actions: {
      'TV_Unit': {
        'raiseTurnOn': {
          firebaseUrl: '/SmartHomeSystem/SmartTVSystem/power_status',
          dataType: 'boolean',
          value: true,
          description: 'Command to turn on the TV'
        },
        'raiseTurnOff': {
          firebaseUrl: '/SmartHomeSystem/SmartTVSystem/power_status',
          dataType: 'boolean',
          value: false,
          description: 'Command to turn off the TV'
        }
      }
    }
  },

  SmartTrafficLightSystem: {
    systemName: 'SmartTrafficLightSystem',
    baseUrl: '/SmartHomeSystem/SmartTrafficLightSystem',
    systemStateUrl: '/SmartHomeSystem/SmartTrafficLightSystem/system_state',
    systemActionsUrl: '/SmartHomeSystem/SmartTrafficLightSystem/system_actions',
    properties: {
      'TrafficLight_Unit': {
        'current_light': {
          firebaseUrl: '/SmartHomeSystem/SmartTrafficLightSystem/light_state',
          dataType: 'string',
          writable: true,
          description: 'Current traffic light state (red/yellow/green)'
        },
        'timer': {
          firebaseUrl: '/SmartHomeSystem/SmartTrafficLightSystem/timer_value',
          dataType: 'number',
          writable: false,
          description: 'Time remaining for current light'
        }
      },
      'Vehicle_Sensor': {
        'vehicle_detected': {
          firebaseUrl: '/SmartHomeSystem/SmartTrafficLightSystem/vehicle_presence',
          dataType: 'boolean',
          writable: false,
          description: 'Vehicle detection status'
        }
      }
    },
    actions: {
      'TrafficLight_Unit': {
        'raiseChangeLight': {
          firebaseUrl: '/SmartHomeSystem/SmartTrafficLightSystem/light_state',
          dataType: 'string',
          value: 'green',
          description: 'Command to change traffic light to green'
        }
      }
    }
  },

  SmartHubSystem: {
    systemName: 'SmartHubSystem',
    baseUrl: '/SmartHomeSystem/SmartHubSystem',
    systemStateUrl: '/SmartHomeSystem/SmartHubSystem/system_state',
    systemActionsUrl: '/SmartHomeSystem/SmartHubSystem/system_actions',
    properties: {
      'HUB_Component': {
        'isOn': {
          firebaseUrl: '/SmartHomeSystem/SmartHubSystem/hub_status',
          dataType: 'boolean',
          writable: true,
          description: 'Hub power status'
        },
        'connected_devices': {
          firebaseUrl: '/SmartHomeSystem/SmartHubSystem/device_count',
          dataType: 'number',
          writable: false,
          description: 'Number of connected devices'
        }
      },
      'Network_Component': {
        'wiFi_connection': {
          firebaseUrl: '/SmartHomeSystem/SmartHubSystem/wifi_status',
          dataType: 'boolean',
          writable: false,
          description: 'WiFi connection status'
        }
      }
    },
    actions: {
      'HUB_Component': {
        'raiseTurnOn': {
          firebaseUrl: '/SmartHomeSystem/SmartHubSystem/hub_status',
          dataType: 'boolean',
          value: true,
          description: 'Command to turn on the hub'
        },
        'raiseTurnOff': {
          firebaseUrl: '/SmartHomeSystem/SmartHubSystem/hub_status',
          dataType: 'boolean',
          value: false,
          description: 'Command to turn off the hub'
        }
      }
    }
  },

  SmartLightHUB: {
    systemName: 'SmartLightHUB',
    baseUrl: '/SmartHomeSystem/SmartLightHUB',
    systemStateUrl: '/SmartHomeSystem/SmartLightHUB/system_state',
    systemActionsUrl: '/SmartHomeSystem/SmartLightHUB/system_actions',
    properties: {
      'Network_Component': {
        'wiFi_connection': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/wifi_status',
          dataType: 'boolean',
          writable: false,
          description: 'WiFi connection status'
        }
      },
      'Power_Component': {
        'power_total': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/power_mW',
          dataType: 'number',
          writable: false,
          description: 'Total power consumption'
        }
      },
      'Light1': {
        'isOn': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_isOn',
          dataType: 'boolean',
          writable: true,
          description: 'Light 1 status'
        },
        'isBulbOn': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_status',
          dataType: 'boolean',
          writable: true,
          description: 'Light 1 bulb status'
        },
        'ambient_light': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_brightness',
          dataType: 'number',
          writable: false,
          description: 'Ambient light level'
        },
        'motion_detected': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_motion_detected',
          dataType: 'boolean',
          writable: false,
          description: 'Motion detection status'
        }
      },
      'Light2': {
        'isOn': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light2_isOn',
          dataType: 'boolean',
          writable: true,
          description: 'Light 2 status'
        },
        'isBulbOn': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light2_status',
          dataType: 'boolean',
          writable: true,
          description: 'Light 2 bulb status'
        },
        'ambient_light': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/light1_brightness',
          dataType: 'number',
          writable: false,
          description: 'Ambient light level'
        },
        'motion_detected': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/light2_motion_detected',
          dataType: 'boolean',
          writable: false,
          description: 'Motion detection status'
        }
      },
      'Light3': {
        'isOn': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light3_isOn',
          dataType: 'boolean',
          writable: true,
          description: 'Light 3 status'
        },
        'isBulbOn': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light3_status',
          dataType: 'boolean',
          writable: true,
          description: 'Light 3 bulb status'
        },
        'ambient_light': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light3_brightness',
          dataType: 'number',
          writable: false,
          description: 'Ambient light level'
        },
        'motion_detected': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light3_motion_detected',
          dataType: 'boolean',
          writable: false,
          description: 'Motion detection status'
        }
      }
    },
    actions: {
      'Light1': {
        'raiseTurn_on': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_isOn',
          dataType: 'boolean',
          value: true,
          description: 'Command to turn on Light 1'
        },
        'raiseTurn_off': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_isOn',
          dataType: 'boolean',
          value: false,
          description: 'Command to turn off Light 1'
        },
        'raiseBulb_on': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_status',
          dataType: 'boolean',
          value: true,
          description: 'Command to turn on Light 1 bulb'
        },
        'raiseBulb_off': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light1_status',
          dataType: 'boolean',
          value: false,
          description: 'Command to turn off Light 1 bulb'
        }
      },
      'Light2': {
        'raiseTurn_on': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light2_isOn',
          dataType: 'boolean',
          value: true,
          description: 'Command to turn on Light 2'
        },
        'raiseTurn_off': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light2_isOn',
          dataType: 'boolean',
          value: false,
          description: 'Command to turn off Light 2'
        },
        'raiseBulb_on': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light2_status',
          dataType: 'boolean',
          value: true,
          description: 'Command to turn on Light 2 bulb'
        },
        'raiseBulb_off': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light2_status',
          dataType: 'boolean',
          value: false,
          description: 'Command to turn off Light 2 bulb'
        }
      },
      'Light3': {
        'raiseTurn_on': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light3_isOn',
          dataType: 'boolean',
          value: true,
          description: 'Command to turn on Light 3'
        },
        'raiseTurn_off': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light3_isOn',
          dataType: 'boolean',
          value: false,
          description: 'Command to turn off Light 3'
        },
        'raiseBulb_on': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light3_status',
          dataType: 'boolean',
          value: true,
          description: 'Command to turn on Light 3 bulb'
        },
        'raiseBulb_off': {
          firebaseUrl: '/SmartHomeSystem/SmartLightSystem/Light3_status',
          dataType: 'boolean',
          value: false,
          description: 'Command to turn off Light 3 bulb'
        }
      }
    }
  }
};

let runtimeFirebaseConfigOverrides: Record<string, SystemFirebaseConfig> = {};

export function setRuntimeFirebaseConfigOverrides(overrides: Record<string, SystemFirebaseConfig>) {
  runtimeFirebaseConfigOverrides = overrides;
}

// Helper functions
export function getSystemFirebaseConfig(systemName: string): SystemFirebaseConfig | undefined {
  if (runtimeFirebaseConfigOverrides[systemName]) {
    return runtimeFirebaseConfigOverrides[systemName];
  }
  return FIREBASE_URL_CONFIGS[systemName];
}

export function getPropertyFirebaseUrl(systemName: string, componentName: string, propertyName: string): string | undefined {
  const config = getSystemFirebaseConfig(systemName);
  return config?.properties[componentName]?.[propertyName]?.firebaseUrl;
}

export function getPropertyConfig(systemName: string, componentName: string, propertyName: string): PropertyConfig | undefined {
  const config = getSystemFirebaseConfig(systemName);
  return config?.properties[componentName]?.[propertyName];
}

export function isPropertyWritable(systemName: string, componentName: string, propertyName: string): boolean {
  const config = getPropertyConfig(systemName, componentName, propertyName);
  return config?.writable || false;
}

export function getPropertyDataType(systemName: string, componentName: string, propertyName: string): PropertyConfig['dataType'] | undefined {
  const config = getPropertyConfig(systemName, componentName, propertyName);
  return config?.dataType;
}

export function getSystemStateUrl(systemName: string): string | undefined {
  const config = getSystemFirebaseConfig(systemName);
  return config?.systemStateUrl;
}

export function getSystemActionsUrl(systemName: string): string | undefined {
  const config = getSystemFirebaseConfig(systemName);
  return config?.systemActionsUrl;
}

export function getActionFirebaseUrl(systemName: string, componentName: string, actionName: string): string | undefined {
  const config = getSystemFirebaseConfig(systemName);
  return config?.actions[componentName]?.[actionName]?.firebaseUrl;
}

export function getActionConfig(systemName: string, componentName: string, actionName: string): ActionConfig | undefined {
  const config = getSystemFirebaseConfig(systemName);
  return config?.actions[componentName]?.[actionName];
}

export function getActionDataType(systemName: string, componentName: string, actionName: string): ActionConfig['dataType'] | undefined {
  const config = getActionConfig(systemName, componentName, actionName);
  return config?.dataType;
}

export function getActionValue(systemName: string, componentName: string, actionName: string): any {
  const config = getActionConfig(systemName, componentName, actionName);
  return config?.value;
}

export function getComponentFaultConfig(systemName: string, componentName: string): FaultConfig | undefined {
  const config = getSystemFirebaseConfig(systemName);
  return config?.faults?.[componentName];
}

export function getComponentFaultUrl(systemName: string, componentName: string): string | undefined {
  const config = getComponentFaultConfig(systemName, componentName);
  return config?.faultUrl;
}

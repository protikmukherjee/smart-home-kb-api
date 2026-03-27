// System configuration types based on the generated Java state chart files

export interface ComponentInterface {
  name: string;
  type: 'sensor' | 'actuator' | 'controller' | 'network' | 'power' | 'temperature' | 'unit';
  methods: {
    getters: string[];
    setters: string[];
    actions: string[];
  };
  properties: {
    [key: string]: {
      type: 'boolean' | 'number' | 'string';
      readable: boolean;
      writable: boolean;
    };
  };
}

export interface SystemDefinition {
  name: string;
  displayName: string;
  description: string;
  components: ComponentInterface[];
  mainClass: string;
  dependencies: string[];
}

export interface SystemConfig {
  systems: SystemDefinition[];
}

// Predefined system configurations based on the generated Java files
export const SYSTEM_DEFINITIONS: SystemDefinition[] = [
  {
    name: "SmartGarageDoorSystem",
    displayName: "Smart Garage Door",
    description: "Automated garage door system with ultrasonic motion detection and remote control",
    mainClass: "SmartGarageDoorSystem",
    dependencies: ["GarageDoor_Unit", "UltraSonic_Sensor", "Button_Component"],
    components: [
      {
        name: "GarageDoor_Unit",
        type: "unit",
        methods: {
          getters: ["getIsOpen", "getIsMoving"],
          setters: ["setIsOpen", "setIsMoving"],
          actions: ["raiseOn", "raiseOff", "raiseOpen_door", "raiseClose_door"]
        },
        properties: {
          isOpen: { type: "boolean", readable: true, writable: true },
          isMoving: { type: "boolean", readable: true, writable: true },
          block: { type: "boolean", readable: true, writable: true },
          door_closed: { type: "boolean", readable: true, writable: true },
          door_status: { type: "string", readable: true, writable: true }
        }
      },
      {
        name: "UltraSonic_Sensor",
        type: "sensor",
        methods: {
          getters: ["getDistance", "getMotion_detected"],
          setters: ["setDistance", "setMotion_detected"],
          actions: []
        },
        properties: {
          distance: { type: "number", readable: true, writable: true },
          motion_detected: { type: "boolean", readable: true, writable: false }
        }
      },
      {
        name: "Network_Component",
        type: "network",
        methods: {
          getters: ["getWiFi_connection", "getSignal_strength"],
          setters: ["setWiFi_connection", "setSignal_strength"],
          actions: []
        },
        properties: {
          wiFi_connection: { type: "boolean", readable: true, writable: true },
          signal_strength: { type: "number", readable: true, writable: true }
        }
      },
      {
        name: "Power_Component",
        type: "power",
        methods: {
          getters: ["getPower_total", "getBattery_level"],
          setters: ["setPower_total", "setBattery_level"],
          actions: []
        },
        properties: {
          power_total: { type: "number", readable: true, writable: true },
          battery_level: { type: "number", readable: true, writable: true }
        }
      },
      {
        name: "DeviceTemp_Component",
        type: "temperature",
        methods: {
          getters: ["getTemp_value"],
          setters: ["setTemp_value"],
          actions: []
        },
        properties: {
          temp_value: { type: "number", readable: true, writable: true }
        }
      }
    ]
  },
  {
    name: "SmartFireSystem",
    displayName: "Smart Fire Detection",
    description: "Fire detection and alarm system with smoke and heat sensors",
    mainClass: "SmartFireSystem",
    dependencies: ["Smoke_Sensor", "Heat_Sensor", "Alarm_Unit", "Sprinkler_System"],
    components: [
      {
        name: "Smoke_Sensor",
        type: "sensor",
        methods: {
          getters: ["getSmoke_detected", "getSmoke_level"],
          setters: ["setSmoke_detected", "setSmoke_level"],
          actions: []
        },
        properties: {
          smoke_detected: { type: "boolean", readable: true, writable: false },
          smoke_level: { type: "number", readable: true, writable: true }
        }
      },
      {
        name: "Flame_Sensor",
        type: "sensor",
        methods: {
          getters: ["getFlame_detected", "getFlame_level"],
          setters: ["setFlame_detected", "setFlame_level"],
          actions: []
        },
        properties: {
          flame_detected: { type: "boolean", readable: true, writable: false },
          flame_level: { type: "number", readable: true, writable: true }
        }
      },
      {
        name: "Heat_Sensor",
        type: "sensor",
        methods: {
          getters: ["getHeat_detected", "getTemperature"],
          setters: ["setHeat_detected", "setTemperature"],
          actions: []
        },
        properties: {
          heat_detected: { type: "boolean", readable: true, writable: false },
          temperature: { type: "number", readable: true, writable: true }
        }
      },
      { 
        name: "Network_Component",
        type: "network",
        methods: {
          getters: ["getWiFi_connection", "getSignal_strength"],
          setters: ["setWiFi_connection", "setSignal_strength"],
          actions: []
        },
        properties: {
          wiFi_connection: { type: "boolean", readable: true, writable: true },
          signal_strength: { type: "number", readable: true, writable: true }
        }
      },
      {
        name: "Power_Component",
        type: "power",
        methods: {
          getters: ["getPower_total"],
          setters: ["setPower_total"],
          actions: []
        },
        properties: {
          power_total: { type: "number", readable: true, writable: true }
        }
      },
      {
        name: "DeviceTemp_Component",
        type: "temperature",
        methods: {
          getters: ["getTemp_value"],
          setters: ["setTemp_value"],
          actions: []
        },
        properties: {
          temp_value: { type: "number", readable: true, writable: true }
        }
      },
      {
        name: "Alarm_Unit",
        type: "actuator",
        methods: {
          getters: ["getIsActive", "getAlarm_level"],
          setters: ["setIsActive", "setAlarm_level"],
          actions: ["raisePause", "raiseResume"]
        },
        properties: {
          isActive: { type: "boolean", readable: true, writable: true },
          isPaused: { type: "boolean", readable: true, writable: true },
        }
      }
      // {
      //   name: "Sprinkler_System",
      //   type: "actuator",
      //   methods: {
      //     getters: ["getIsActive", "getWater_pressure"],
      //     setters: ["setIsActive", "setWater_pressure"],
      //     actions: ["raisePause", "raiseResume"]
      //   },
      //   properties: {
      //     isActive: { type: "boolean", readable: true, writable: true },
      //     water_pressure: { type: "number", readable: true, writable: true }
      //   }
      // }
    ]
  },
  {
    name: "SmartLightHUB",
    displayName: "Smart Light Hub",
    description: "Centralized light management hub controlling multiple LED light systems with power optimization",
    mainClass: "SmartLightHUB",
    dependencies: ["SmartLightSystem", "Hub_PowerManager", "Network_Component"],
    components: [
      {
        //light system as units
        name: "Light1",
        type: "unit",
        methods: {
          getters: ["getIsOn"],
          setters: ["setIsOn"],
          actions: ["raiseTurn_on", "raiseTurn_off", "raiseBulb_on", "raiseBulb_off"]
        },
        properties: {
          isOn: { type: "boolean", readable: true, writable: true },
          isBulbOn: { type: "boolean", readable: true, writable: true },
          ambient_light: { type: "number", readable: true, writable: false },
          motion_detected: { type: "boolean", readable: true, writable: false }
        }
      },
      {
        name: "Light2",
        type: "unit",
        methods: {
          getters: ["getIsOn"],
          setters: ["setIsOn"],
          actions: ["raiseTurn_on", "raiseTurn_off", "raiseBulb_on", "raiseBulb_off"]
        },
        properties: {
          isOn: { type: "boolean", readable: true, writable: true },
          isBulbOn: { type: "boolean", readable: true, writable: true },
          ambient_light: { type: "number", readable: true, writable: false },
          motion_detected: { type: "boolean", readable: true, writable: false }
        }
      },
      {
        name: "Light3",
        type: "unit",
        methods: {
          getters: ["getIsOn"],
          setters: ["setIsOn"],
          actions: ["raiseTurn_on", "raiseTurn_off", "raiseBulb_on", "raiseBulb_off"]
        },
        properties: {
          isOn: { type: "boolean", readable: true, writable: true },
          isBulbOn: { type: "boolean", readable: true, writable: true },
          ambient_light: { type: "number", readable: true, writable: false },
          motion_detected: { type: "boolean", readable: true, writable: false }
        }
      },
      {
        name: "Network_Component",
        type: "network",
        methods: {
          getters: ["getConnection"],
          setters: ["setConnection"],
          actions: ["raiseError", "raiseConnect"]
        },
        properties: {
          connection: { type: "boolean", readable: true, writable: true }
        }
      },
      {
        name: "Power_Component",
        type: "power",
        methods: {
          getters: ["getIndex", "getTotal", "getThreshold", "getThresholdReached"],
          setters: ["setIndex", "setTotal", "setThreshold", "setThresholdReached"],
          actions: []
        },
        properties: {
          index: { type: "number", readable: true, writable: true },
          total: { type: "number", readable: true, writable: true },
          threshold: { type: "number", readable: true, writable: true },
          thresholdReached: { type: "boolean", readable: true, writable: true }
        }
      },
    ]
  }
];

// Helper functions
export function getSystemByName(name: string): SystemDefinition | undefined {
  return SYSTEM_DEFINITIONS.find(system => system.name === name);
}

export function getComponentsByType(system: SystemDefinition, type: ComponentInterface['type']): ComponentInterface[] {
  return system.components.filter(component => component.type === type);
}

export function getAllSystemNames(): string[] {
  return SYSTEM_DEFINITIONS.map(system => system.name);
}

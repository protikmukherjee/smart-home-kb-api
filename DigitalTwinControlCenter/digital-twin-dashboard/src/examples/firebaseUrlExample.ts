// Example showing how Firebase URLs are now configured and used

import { 
  getSystemStateUrl, 
  getSystemActionsUrl, 
  getPropertyFirebaseUrl,
  getPropertyConfig 
} from '@/config/firebaseUrlConfig';

// Example: Getting configured URLs for SmartGarageDoorSystem

console.log('=== Firebase URL Configuration Examples ===');

// System-level URLs
const systemName = 'SmartGarageDoorSystem';
console.log(`\nSystem: ${systemName}`);
console.log(`System State URL: ${getSystemStateUrl(systemName)}`);
console.log(`System Actions URL: ${getSystemActionsUrl(systemName)}`);

// Component property URLs
const componentName = 'GarageDoor_Unit';
console.log(`\nComponent: ${componentName}`);

const doorOpenUrl = getPropertyFirebaseUrl(systemName, componentName, 'door_open');
console.log(`Door Open Status URL: ${doorOpenUrl}`);

const doorPositionUrl = getPropertyFirebaseUrl(systemName, componentName, 'position');
console.log(`Door Position URL: ${doorPositionUrl}`);

const doorMovingUrl = getPropertyFirebaseUrl(systemName, componentName, 'isMoving');
console.log(`Door Moving Status URL: ${doorMovingUrl}`);

// Property configurations
console.log(`\nProperty Configurations:`);
const doorOpenConfig = getPropertyConfig(systemName, componentName, 'door_open');
console.log(`Door Open Config:`, doorOpenConfig);

const doorPositionConfig = getPropertyConfig(systemName, componentName, 'position');
console.log(`Door Position Config:`, doorPositionConfig);

// Example for sensor component
const sensorComponent = 'UltraSonic_Sensor';
console.log(`\nSensor Component: ${sensorComponent}`);

const distanceUrl = getPropertyFirebaseUrl(systemName, sensorComponent, 'distance');
console.log(`Distance Sensor URL: ${distanceUrl}`);

const motionUrl = getPropertyFirebaseUrl(systemName, sensorComponent, 'motion_detected');
console.log(`Motion Detection URL: ${motionUrl}`);

// Example for power component
const powerComponent = 'Power_Component';
console.log(`\nPower Component: ${powerComponent}`);

const powerTotalUrl = getPropertyFirebaseUrl(systemName, powerComponent, 'power_total');
console.log(`Power Total URL: ${powerTotalUrl}`);

const batteryUrl = getPropertyFirebaseUrl(systemName, powerComponent, 'battery_level');
console.log(`Battery Level URL: ${batteryUrl}`);

// Example for another system
const lightSystem = 'SmartLightSystem';
console.log(`\n=== Another System Example ===`);
console.log(`System: ${lightSystem}`);
console.log(`System State URL: ${getSystemStateUrl(lightSystem)}`);

const lightComponent = 'LEDLight_Unit';
const lightStatusUrl = getPropertyFirebaseUrl(lightSystem, lightComponent, 'isOn');
console.log(`Light Status URL: ${lightStatusUrl}`);

const brightnessUrl = getPropertyFirebaseUrl(lightSystem, lightComponent, 'brightness');
console.log(`Brightness URL: ${brightnessUrl}`);

/*
Expected Output:

=== Firebase URL Configuration Examples ===

System: SmartGarageDoorSystem
System State URL: /SmartHomeSystem/SmartGarageDoorSystem/system_state
System Actions URL: /SmartHomeSystem/SmartGarageDoorSystem/system_actions

Component: GarageDoor_Unit
Door Open Status URL: /SmartHomeSystem/SmartGarageDoorSystem/status_door
Door Position URL: /SmartHomeSystem/SmartGarageDoorSystem/door_position
Door Moving Status URL: /SmartHomeSystem/SmartGarageDoorSystem/door_moving

Property Configurations:
Door Open Config: {
  firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/status_door',
  dataType: 'boolean',
  writable: true,
  description: 'Garage door open/closed status'
}
Door Position Config: {
  firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/door_position',
  dataType: 'number',
  writable: false,
  description: 'Door position percentage (0-100)'
}

Sensor Component: UltraSonic_Sensor
Distance Sensor URL: /SmartHomeSystem/SmartGarageDoorSystem/sensor_distance
Motion Detection URL: /SmartHomeSystem/SmartGarageDoorSystem/motion_detected

Power Component: Power_Component
Power Total URL: /SmartHomeSystem/SmartGarageDoorSystem/power_usage
Battery Level URL: /SmartHomeSystem/SmartGarageDoorSystem/battery_level

=== Another System Example ===
System: SmartLightSystem
System State URL: /SmartHomeSystem/SmartLightSystem/system_state
Light Status URL: /SmartHomeSystem/SmartLightSystem/light_status
Brightness URL: /SmartHomeSystem/SmartLightSystem/brightness_level

*/

export {};

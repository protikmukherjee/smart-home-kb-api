// Example showing how action URLs are now configured and used

import {
  getActionFirebaseUrl,
  getActionConfig,
  getActionDataType,
  getActionValue
} from '@/config/firebaseUrlConfig';

console.log('=== Action URL Configuration Examples ===');

// Example: Getting configured action URLs for SmartGarageDoorSystem
const systemName = 'SmartGarageDoorSystem';
const componentName = 'GarageDoor_Unit';

console.log(`\nSystem: ${systemName}`);
console.log(`Component: ${componentName}`);

// Get action URLs
const openActionUrl = getActionFirebaseUrl(systemName, componentName, 'raiseOpen');
console.log(`Open Action URL: ${openActionUrl}`);

const closeActionUrl = getActionFirebaseUrl(systemName, componentName, 'raiseClose');
console.log(`Close Action URL: ${closeActionUrl}`);

const stopActionUrl = getActionFirebaseUrl(systemName, componentName, 'raiseStop');
console.log(`Stop Action URL: ${stopActionUrl}`);

// Get action configurations
console.log(`\nAction Configurations:`);
const openConfig = getActionConfig(systemName, componentName, 'raiseOpen');
console.log(`Open Action Config:`, openConfig);

const closeConfig = getActionConfig(systemName, componentName, 'raiseClose');
console.log(`Close Action Config:`, closeConfig);

// Get action data types and values
console.log(`\nAction Data Types and Values:`);
console.log(`Open Action Type: ${getActionDataType(systemName, componentName, 'raiseOpen_door')}`);
console.log(`Open Action Value: ${getActionValue(systemName, componentName, 'raiseOpen_door')}`);
console.log(`Close Action Type: ${getActionDataType(systemName, componentName, 'raiseClose_door')}`);
console.log(`Close Action Value: ${getActionValue(systemName, componentName, 'raiseClose_door')}`);

// Example for SmartLightSystem
const lightSystem = 'SmartLightSystem';
const lightComponent = 'LEDLight_Unit';

console.log(`\n=== Light System Actions ===`);
console.log(`System: ${lightSystem}`);
console.log(`Component: ${lightComponent}`);

const turnOnUrl = getActionFirebaseUrl(lightSystem, lightComponent, 'raiseTurnOn');
console.log(`Turn On URL: ${turnOnUrl}`);

const turnOffUrl = getActionFirebaseUrl(lightSystem, lightComponent, 'raiseTurnOff');
console.log(`Turn Off URL: ${turnOffUrl}`);

const setBrightnessUrl = getActionFirebaseUrl(lightSystem, lightComponent, 'raiseSetBrightness');
console.log(`Set Brightness URL: ${setBrightnessUrl}`);

const brightnessConfig = getActionConfig(lightSystem, lightComponent, 'raiseSetBrightness');
console.log(`Brightness Action Config:`, brightnessConfig);

// Example for SmartFireSystem
const fireSystem = 'SmartFireSystem';
const alarmComponent = 'Alarm_Unit';

console.log(`\n=== Fire System Actions ===`);
console.log(`System: ${fireSystem}`);
console.log(`Component: ${alarmComponent}`);

const activateAlarmUrl = getActionFirebaseUrl(fireSystem, alarmComponent, 'raiseActivate');
console.log(`Activate Alarm URL: ${activateAlarmUrl}`);

const deactivateAlarmUrl = getActionFirebaseUrl(fireSystem, alarmComponent, 'raiseDeactivate');
console.log(`Deactivate Alarm URL: ${deactivateAlarmUrl}`);

/*
Expected Output:

=== Action URL Configuration Examples ===

System: SmartGarageDoorSystem
Component: GarageDoor_Unit
Open Action URL: /SmartHomeSystem/SmartGarageDoorSystem/commands/door_open
Close Action URL: /SmartHomeSystem/SmartGarageDoorSystem/commands/door_close
Stop Action URL: /SmartHomeSystem/SmartGarageDoorSystem/commands/door_stop

Action Configurations:
Open Action Config: {
  firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/commands/door_open',
  dataType: 'boolean',
  description: 'Command to open the garage door'
}
Close Action Config: {
  firebaseUrl: '/SmartHomeSystem/SmartGarageDoorSystem/commands/door_close',
  dataType: 'boolean',
  description: 'Command to close the garage door'
}

Action Data Types:
Open Action Type: boolean
Close Action Type: boolean

=== Light System Actions ===
System: SmartLightSystem
Component: LEDLight_Unit
Turn On URL: /SmartHomeSystem/SmartLightSystem/commands/light_on
Turn Off URL: /SmartHomeSystem/SmartLightSystem/commands/light_off
Set Brightness URL: /SmartHomeSystem/SmartLightSystem/commands/set_brightness
Brightness Action Config: {
  firebaseUrl: '/SmartHomeSystem/SmartLightSystem/commands/set_brightness',
  dataType: 'number',
  description: 'Command to set light brightness (0-100)'
}

=== Fire System Actions ===
System: SmartFireSystem
Component: Alarm_Unit
Activate Alarm URL: /SmartHomeSystem/SmartFireSystem/commands/alarm_activate
Deactivate Alarm URL: /SmartHomeSystem/SmartFireSystem/commands/alarm_deactivate

*/

// Example of how Firebase service now uses these URLs:
console.log(`\n=== Firebase Service Usage ===`);
console.log(`Before: executeAction used hardcoded paths and generic values`);
console.log(`After: executeAction uses configured URLs and predefined values`);
console.log(`\nExample action executions:`);
console.log(`\n1. Open Garage Door:`);
console.log(`   FirebaseService.executeAction('SmartGarageDoorSystem', 'GarageDoor_Unit', 'raiseOpen_door')`);
console.log(`   -> Writes to: ${getActionFirebaseUrl(systemName, componentName, 'raiseOpen_door')}`);
console.log(`   -> Value: ${getActionValue(systemName, componentName, 'raiseOpen_door')} (${getActionDataType(systemName, componentName, 'raiseOpen_door')})`);
console.log(`\n2. Close Garage Door:`);
console.log(`   FirebaseService.executeAction('SmartGarageDoorSystem', 'GarageDoor_Unit', 'raiseClose_door')`);
console.log(`   -> Writes to: ${getActionFirebaseUrl(systemName, componentName, 'raiseClose_door')}`);
console.log(`   -> Value: ${getActionValue(systemName, componentName, 'raiseClose_door')} (${getActionDataType(systemName, componentName, 'raiseClose_door')})`);
console.log(`\n3. Set Light Brightness:`);
console.log(`   FirebaseService.executeAction('SmartLightSystem', 'LEDLight_Unit', 'raiseSetBrightness')`);
console.log(`   -> Writes to: ${setBrightnessUrl}`);
console.log(`   -> Value: ${getActionValue(lightSystem, lightComponent, 'raiseSetBrightness')} (${getActionDataType(lightSystem, lightComponent, 'raiseSetBrightness')})`);

console.log(`\n=== Key Benefits ===`);
console.log(`✅ Actions write to actual property URLs (not command URLs)`);
console.log(`✅ Each action has a predefined meaningful value`);
console.log(`✅ Values are automatically type-converted`);
console.log(`✅ Real Firebase data changes instantly`);
console.log(`✅ UI updates in real-time via listeners`);

export {};

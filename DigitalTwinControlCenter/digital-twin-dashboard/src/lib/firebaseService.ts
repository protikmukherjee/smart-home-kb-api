import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, off } from 'firebase/database';
import {
  getPropertyFirebaseUrl,
  getPropertyConfig,
  getSystemFirebaseConfig,
  getSystemStateUrl,
  getActionFirebaseUrl,
  getActionConfig
} from '@/config/firebaseUrlConfig';

// Simplified Firebase service for real system mode
export class FirebaseService {
  private static database: any = null;

  static initialize(config: any) {
    if (!this.database) {
      const app = initializeApp(config);
      this.database = getDatabase(app);
    }
  }

  // Read system state using configured Firebase URL
  static async getSystemState(systemName: string): Promise<any> {
    const systemStateUrl = getSystemStateUrl(systemName);
    if (!systemStateUrl) {
      console.warn(`No system state URL configured for ${systemName}`);
      return null;
    }

    try {
      const snapshot = await get(ref(this.database, systemStateUrl));
      const systemState = snapshot.exists() ? snapshot.val() : null;

      // Return system state with isOn property from the configured URL
      return {
        isOn: systemState,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error(`Error reading system state for ${systemName} from ${systemStateUrl}:`, error);
      return null;
    }
  }

  // Update system state using configured Firebase URL
  static async updateSystemState(systemName: string, state: any): Promise<void> {
    const systemStateUrl = getSystemStateUrl(systemName);
    if (!systemStateUrl) {
      console.warn(`No system state URL configured for ${systemName}`);
      return;
    }

    try {
      // If updating isOn property, write directly to the configured URL
      if (state.isOn !== undefined) {
        await set(ref(this.database, systemStateUrl), state.isOn);
        console.log(`System isOn state updated for ${systemName} to ${state.isOn} at ${systemStateUrl}`);
      } else {
        // For other properties, write the full state object
        await set(ref(this.database, systemStateUrl), { ...state, lastUpdated: Date.now() });
        console.log(`System state updated for ${systemName} at ${systemStateUrl}`);
      }
    } catch (error) {
      console.error(`Error updating system state for ${systemName} at ${systemStateUrl}:`, error);
      throw error;
    }
  }

  // Get component state using configured Firebase URLs
  static async getComponentState(systemName: string, componentName: string): Promise<any> {
    try {
      const componentState: any = {};
      const systemFirebaseConfig = getSystemFirebaseConfig(systemName);

      if (!systemFirebaseConfig) {
        console.warn(`No Firebase config found for system ${systemName}`);
        return null;
      }

      // Get the component's property configurations
      const componentProperties = systemFirebaseConfig.properties[componentName];
      if (!componentProperties) {
        console.warn(`No properties configured for component ${systemName}/${componentName}`);
        return null;
      }

      // For each configured property, get its value from Firebase
      for (const [propertyName, propertyConfig] of Object.entries(componentProperties)) {
        try {
          const snapshot = await get(ref(this.database, propertyConfig.firebaseUrl));
          if (snapshot.exists()) {
            componentState[propertyName] = snapshot.val();
          }
        } catch (error) {
          console.warn(`Error reading property ${propertyName} from ${propertyConfig.firebaseUrl}:`, error);
        }
      }

      return Object.keys(componentState).length > 0 ? componentState : null;
    } catch (error) {
      console.error(`Error reading component state for ${systemName}/${componentName}:`, error);
      return null;
    }
  }

  // Get specific property value using configured Firebase URL
  static async getPropertyValue(systemName: string, componentName: string, propertyName: string): Promise<any> {
    const firebaseUrl = getPropertyFirebaseUrl(systemName, componentName, propertyName);
    if (!firebaseUrl) {
      console.warn(`No Firebase URL configured for ${systemName}/${componentName}/${propertyName}`);
      return null;
    }

    try {
      const snapshot = await get(ref(this.database, firebaseUrl));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error(`Error reading property ${propertyName} from ${firebaseUrl}:`, error);
      return null;
    }
  }

  static async getRawValue(firebaseUrl: string): Promise<any> {
    if (!firebaseUrl) {
      return null;
    }

    if (!this.database) {
      console.warn("FirebaseService not initialized. Skipping raw read.");
      return null;
    }

    try {
      const snapshot = await get(ref(this.database, firebaseUrl));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error(`Error reading raw value from ${firebaseUrl}:`, error);
      return null;
    }
  }

  // Update component state using configured Firebase URLs
  static async updateComponentState(systemName: string, componentName: string, state: any): Promise<void> {
    try {
      // Update each property to its configured Firebase URL
      for (const [propertyName, value] of Object.entries(state)) {
        await this.setPropertyValue(systemName, componentName, propertyName, value);
      }
    } catch (error) {
      console.error(`Error updating component state for ${systemName}/${componentName}:`, error);
      throw error;
    }
  }

  // Set specific property value using configured Firebase URL
  static async setPropertyValue(systemName: string, componentName: string, propertyName: string, value: any): Promise<void> {
    const firebaseUrl = getPropertyFirebaseUrl(systemName, componentName, propertyName);
    const config = getPropertyConfig(systemName, componentName, propertyName);

    if (!firebaseUrl) {
      console.warn(`No Firebase URL configured for ${systemName}/${componentName}/${propertyName}`);
      return;
    }

    if (!config?.writable) {
      console.warn(`Property ${propertyName} is not writable`);
      return;
    }

    try {
      // Convert value to the correct data type
      let convertedValue = value;
      if (config.dataType === 'boolean') {
        convertedValue = Boolean(value);
      } else if (config.dataType === 'number') {
        convertedValue = Number(value);
      } else if (config.dataType === 'string') {
        convertedValue = String(value);
      }

      await set(ref(this.database, firebaseUrl), convertedValue);
      console.log(`Property ${propertyName} set to ${convertedValue} at ${firebaseUrl}`);
    } catch (error) {
      console.error(`Error setting property ${propertyName} to ${firebaseUrl}:`, error);
      throw error;
    }
  }

  // Execute command/action using configured Firebase URL
  static async executeAction(systemName: string, componentName: string, action: string, params?: any): Promise<void> {
    const actionFirebaseUrl = getActionFirebaseUrl(systemName, componentName, action);
    const actionConfig = getActionConfig(systemName, componentName, action);

    if (!actionFirebaseUrl) {
      console.warn(`No Firebase URL configured for action ${systemName}/${componentName}/${action}`);
      return;
    }

    if (!actionConfig) {
      console.warn(`No action config found for ${systemName}/${componentName}/${action}`);
      return;
    }

    try {
      // Use the configured value for this action
      let actionValue = actionConfig.value;

      // If params are provided, use them instead of the configured value
      if (params !== undefined) {
        actionValue = params;
      }

      // Convert value to the correct data type
      if (actionConfig.dataType === 'boolean') {
        actionValue = Boolean(actionValue);
      } else if (actionConfig.dataType === 'number') {
        actionValue = Number(actionValue);
      } else if (actionConfig.dataType === 'string') {
        actionValue = String(actionValue);
      }

      await set(ref(this.database, actionFirebaseUrl), actionValue);
      console.log(`Action ${action} executed on ${systemName}/${componentName}:`);
      console.log(`  URL: ${actionFirebaseUrl}`);
      console.log(`  Value: ${actionValue} (${typeof actionValue})`);
      console.log(`  Description: ${actionConfig.description}`);
    } catch (error) {
      console.error(`Error executing action ${action} on ${systemName}/${componentName}:`, error);
      throw error;
    }
  }

  // Subscribe to system state changes using configured Firebase URL
  static subscribeToSystemState(systemName: string, callback: (data: any) => void): () => void {
    const systemStateUrl = getSystemStateUrl(systemName);
    if (!systemStateUrl) {
      console.warn(`No system state URL configured for ${systemName}`);
      return () => { }; // Return empty unsubscribe function
    }

    const dataRef = ref(this.database, systemStateUrl);

    const listener = (snapshot: any) => {
      const rawData = snapshot.exists() ? snapshot.val() : null;

      // Transform the raw data to match expected system state format
      const systemState = {
        isOn: rawData, // The configured URL should contain the isOn boolean value
        lastUpdated: Date.now()
      };

      console.log(`Firebase system state update for ${systemName}:`, systemState);
      callback(systemState);
    };

    onValue(dataRef, listener, (error) => {
      console.error(`Error listening to system state for ${systemName}:`, error);
    });

    console.log(`Subscribed to system state for ${systemName} at ${systemStateUrl}`);

    return () => {
      console.log(`Unsubscribing from system state for ${systemName}`);
      off(dataRef, 'value', listener);
    };
  }

  // Subscribe to component state changes using configured Firebase URLs
  static subscribeToComponentState(systemName: string, componentName: string, callback: (data: any) => void): () => void {
    const systemFirebaseConfig = getSystemFirebaseConfig(systemName);

    if (!systemFirebaseConfig) {
      console.warn(`No Firebase config found for system ${systemName}`);
      return () => { }; // Return empty unsubscribe function
    }

    const componentProperties = systemFirebaseConfig.properties[componentName];
    if (!componentProperties) {
      console.warn(`No properties configured for component ${systemName}/${componentName}`);
      return () => { }; // Return empty unsubscribe function
    }

    // Subscribe to all properties of the component
    const unsubscribeFunctions: (() => void)[] = [];
    const componentState: any = {};

    // Track how many properties we're waiting for initial values
    let initializedProperties = 0;
    const totalProperties = Object.keys(componentProperties).length;

    for (const [propertyName, propertyConfig] of Object.entries(componentProperties)) {
      const dataRef = ref(this.database, propertyConfig.firebaseUrl);

      const listener = (snapshot: any) => {
        const oldValue = componentState[propertyName];
        const newValue = snapshot.exists() ? snapshot.val() : null;

        // Update the component state
        componentState[propertyName] = newValue;

        // Track initialization
        if (oldValue === undefined) {
          initializedProperties++;
        }

        // Only call callback after we have at least one property or all properties are initialized
        if (initializedProperties > 0) {
          console.log(`Firebase update for ${systemName}/${componentName}/${propertyName}:`, newValue);
          callback({ ...componentState });
        }
      };

      onValue(dataRef, listener, (error) => {
        console.error(`Error listening to ${propertyConfig.firebaseUrl}:`, error);
      });

      // Store unsubscribe function
      unsubscribeFunctions.push(() => off(dataRef, 'value', listener));
    }

    console.log(`Subscribed to ${totalProperties} properties for ${systemName}/${componentName}`);

    return () => {
      console.log(`Unsubscribing from ${systemName}/${componentName}`);
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }

  // Subscribe to realtime system notifications from the /notifications path
  static subscribeToNotifications(callback: (notifications: Record<string, any>) => void): () => void {
    if (!this.database) {
      console.warn("FirebaseService not initialized. Cannot subscribe to notifications.");
      return () => { };
    }

    const dataRef = ref(this.database, "/notifications");
    const listener = (snapshot: any) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    };

    onValue(dataRef, listener, (error) => {
      console.error("Error listening to /notifications:", error);
    });

    return () => {
      off(dataRef, 'value', listener);
    };
  }
}

export default FirebaseService;

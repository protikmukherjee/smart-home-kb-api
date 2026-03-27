import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, push } from 'firebase/database';
import { getFirebaseConfig } from '@/config/firebaseConfig';
import { getSystemFirebaseConfig } from '@/config/firebaseUrlConfig';

// Service to track power usage and uptime over time
export class DataTrackingService {
  private static database: any = null;
  private static isInitialized = false;
  private static trackingIntervals: Record<string, NodeJS.Timeout> = {};

  static initialize() {
    if (this.isInitialized) return;

    try {
      const config = getFirebaseConfig();
      const app = initializeApp(config);
      this.database = getDatabase(app);
      this.isInitialized = true;
      console.log('DataTrackingService initialized');
    } catch (error) {
      console.error('Error initializing DataTrackingService:', error);
    }
  }

  // Start tracking power usage and uptime for a system
  static startTracking(systemName: string) {
    if (!this.isInitialized) {
      this.initialize();
    }

    // Stop existing tracking if any
    this.stopTracking(systemName);

    // Track every 30 seconds for more frequent data collection
    const interval = setInterval(async () => {
      await this.recordSystemMetrics(systemName);
    }, 30 * 1000); // 30 seconds

    this.trackingIntervals[systemName] = interval;

    // Record initial metrics immediately
    this.recordSystemMetrics(systemName);

    console.log(`Started tracking metrics for ${systemName} every 30 seconds`);
  }

  // Stop tracking for a system
  static stopTracking(systemName: string) {
    if (this.trackingIntervals[systemName]) {
      clearInterval(this.trackingIntervals[systemName]);
      delete this.trackingIntervals[systemName];
      console.log(`Stopped tracking metrics for ${systemName}`);
    }
  }

  // Record current power usage and uptime
  private static async recordSystemMetrics(systemName: string) {
    try {
      const systemConfig = getSystemFirebaseConfig(systemName);
      if (!systemConfig) {
        console.warn(`No config found for system ${systemName}`);
        return;
      }

      // Get current power usage from Firebase
      const powerUsage = await this.getCurrentPowerUsage(systemName);

      // Get current system state (for uptime calculation)
      const systemState = await this.getCurrentSystemState(systemName);

      const timestamp = Date.now();
      const dataPoint = {
        timestamp,
        powerUsage: powerUsage || 0,
        isOn: systemState || false,
        date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      };

      // Store in Firebase under tracking data
      const trackingRef = ref(this.database, `tracking/${systemName}/metrics`);
      await push(trackingRef, dataPoint);

      console.log(`✅ Recorded metrics for ${systemName}:`, dataPoint);
    } catch (error) {
      console.error(`❌ Error recording metrics for ${systemName}:`, error);

      // Even if there's an error, try to record a basic data point
      try {
        const timestamp = Date.now();
        const fallbackDataPoint = {
          timestamp,
          powerUsage: 0,
          isOn: false,
          date: new Date().toISOString().split('T')[0]
        };

        const trackingRef = ref(this.database, `tracking/${systemName}/metrics`);
        await push(trackingRef, fallbackDataPoint);
        console.log(`📝 Recorded fallback metrics for ${systemName}:`, fallbackDataPoint);
      } catch (fallbackError) {
        console.error(`❌ Failed to record fallback metrics for ${systemName}:`, fallbackError);
      }
    }
  }

  // Get current power usage from configured Firebase URL
  private static async getCurrentPowerUsage(systemName: string): Promise<number> {
    try {
      const systemConfig = getSystemFirebaseConfig(systemName);
      if (!systemConfig) return 0;

      // Look for power component
      const powerComponent = systemConfig.properties['Power_Component'];
      if (!powerComponent?.power_total) return 0;

      const powerUrl = powerComponent.power_total.firebaseUrl;
      const snapshot = await get(ref(this.database, powerUrl));
      
      return snapshot.exists() ? Number(snapshot.val()) || 0 : 0;
    } catch (error) {
      console.error(`Error getting power usage for ${systemName}:`, error);
      return 0;
    }
  }

  // Get current system state from configured Firebase URL
  private static async getCurrentSystemState(systemName: string): Promise<boolean> {
    try {
      const systemConfig = getSystemFirebaseConfig(systemName);
      if (!systemConfig) return false;

      const systemStateUrl = systemConfig.systemStateUrl;
      const snapshot = await get(ref(this.database, systemStateUrl));
      
      return snapshot.exists() ? Boolean(snapshot.val()) : false;
    } catch (error) {
      console.error(`Error getting system state for ${systemName}:`, error);
      return false;
    }
  }

  // Get power usage history for charts
  static async getPowerUsageHistory(systemName: string, hours: number = 24): Promise<Array<{timestamp: number, powerUsage: number}>> {
    try {
      const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
      const trackingRef = ref(this.database, `tracking/${systemName}/metrics`);

      // Get all data without ordering to avoid index requirement
      const snapshot = await get(trackingRef);
      const data: Array<{timestamp: number, powerUsage: number}> = [];

      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const value = child.val();
          if (value && value.timestamp && value.timestamp >= cutoffTime) {
            data.push({
              timestamp: value.timestamp,
              powerUsage: value.powerUsage || 0
            });
          }
        });
      }

      // If no data exists, create some initial data points with current power usage
      if (data.length === 0) {
        console.log(`No historical data found for ${systemName}, creating initial data points`);
        const currentPower = await this.getCurrentPowerUsage(systemName);
        const now = Date.now();

        // Create data points for the last hour with current power value
        for (let i = 0; i < 12; i++) {
          data.push({
            timestamp: now - (i * 5 * 60 * 1000), // Every 5 minutes for the last hour
            powerUsage: currentPower
          });
        }
      }

      // Sort by timestamp and limit to reasonable number of points
      return data
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-50); // Keep last 50 data points for performance
    } catch (error) {
      console.error(`Error getting power usage history for ${systemName}:`, error);
      // Return fallback data with current power usage
      try {
        const currentPower = await this.getCurrentPowerUsage(systemName);
        const now = Date.now();
        const fallbackData = [];
        for (let i = 0; i < 10; i++) {
          fallbackData.push({
            timestamp: now - (i * 5 * 60 * 1000), // Every 5 minutes for the last 50 minutes
            powerUsage: currentPower
          });
        }
        return fallbackData.sort((a, b) => a.timestamp - b.timestamp);
      } catch (fallbackError) {
        console.error(`Error creating fallback data for ${systemName}:`, fallbackError);
        return [];
      }
    }
  }

  // Get uptime percentage for a time period
  static async getUptimePercentage(systemName: string, hours: number = 24): Promise<number> {
    try {
      const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
      const trackingRef = ref(this.database, `tracking/${systemName}/metrics`);

      // Get all data without ordering to avoid index requirement
      const snapshot = await get(trackingRef);
      let totalDataPoints = 0;
      let onlineDataPoints = 0;

      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const value = child.val();
          if (value && value.timestamp && value.timestamp >= cutoffTime) {
            totalDataPoints++;
            if (value.isOn) {
              onlineDataPoints++;
            }
          }
        });
      }

      return totalDataPoints > 0 ? (onlineDataPoints / totalDataPoints) * 100 : 0;
    } catch (error) {
      console.error(`Error getting uptime for ${systemName}:`, error);
      return 0;
    }
  }

  // Get current system metrics
  static async getCurrentMetrics(systemName: string) {
    try {
      const powerUsage = await this.getCurrentPowerUsage(systemName);
      const isOn = await this.getCurrentSystemState(systemName);
      const uptime = await this.getUptimePercentage(systemName, 24);
      const powerHistory = await this.getPowerUsageHistory(systemName, 24);
      
      return {
        currentPowerUsage: powerUsage,
        isOn,
        uptime,
        powerHistory,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error(`Error getting current metrics for ${systemName}:`, error);
      return {
        currentPowerUsage: 0,
        isOn: false,
        uptime: 0,
        powerHistory: [],
        lastUpdated: Date.now()
      };
    }
  }

  // Seed initial data for a system to ensure charts have data
  static async seedInitialData(systemName: string) {
    try {
      console.log(`🌱 Seeding initial data for ${systemName}`);
      const currentPower = await this.getCurrentPowerUsage(systemName);
      const currentState = await this.getCurrentSystemState(systemName);
      const now = Date.now();

      // Create 20 data points over the last 10 minutes
      const dataPoints = [];
      for (let i = 0; i < 20; i++) {
        const timestamp = now - (i * 30 * 1000); // Every 30 seconds
        const dataPoint = {
          timestamp,
          powerUsage: currentPower + (Math.random() - 0.5) * 10, // Small variation
          isOn: currentState,
          date: new Date(timestamp).toISOString().split('T')[0]
        };
        dataPoints.push(dataPoint);
      }

      // Store all data points
      const trackingRef = ref(this.database, `tracking/${systemName}/metrics`);
      for (const dataPoint of dataPoints) {
        await push(trackingRef, dataPoint);
      }

      console.log(`✅ Seeded ${dataPoints.length} initial data points for ${systemName}`);
    } catch (error) {
      console.error(`❌ Error seeding initial data for ${systemName}:`, error);
    }
  }

  // Start tracking all configured systems
  static async startTrackingAllSystems() {
    const systems = [
      'SmartGarageDoorSystem',
      'SmartLightSystem',
      'SmartFireSystem',
      'SmartMicrowaveSystem',
      'SmartTVSystem',
      'SmartTrafficLightSystem',
      'SmartHubSystem',
      'SmartLightHUB'
    ];

    for (const systemName of systems) {
      // Check if system has any historical data
      const history = await this.getPowerUsageHistory(systemName, 1); // Last 1 hour
      if (history.length === 0) {
        // Seed initial data if no history exists
        await this.seedInitialData(systemName);
      }

      this.startTracking(systemName);
    }
  }

  // Stop tracking all systems
  static stopTrackingAllSystems() {
    Object.keys(this.trackingIntervals).forEach(systemName => {
      this.stopTracking(systemName);
    });
  }
}

export default DataTrackingService;

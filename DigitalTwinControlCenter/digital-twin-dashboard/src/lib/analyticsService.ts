// Analytics service for aggregating and analyzing system data
export interface PowerUsageData {
  timestamp: number;
  systemName: string;
  powerUsage: number;
  componentBreakdown: Record<string, number>;
}

export interface SystemMetrics {
  systemName: string;
  totalPowerUsage: number;
  averagePowerUsage: number;
  peakPowerUsage: number;
  uptime: number; // percentage
  errorCount: number;
  lastUpdated: number;
}

export interface AnalyticsData {
  totalSystems: number;
  activeSystems: number;
  totalPowerUsage: number;
  averageSystemUptime: number;
  powerUsageHistory: PowerUsageData[];
  systemMetrics: SystemMetrics[];
  componentTypeDistribution: Record<string, number>;
  alertsOverTime: Array<{ timestamp: number; count: number; level: string }>;
}

// Global analytics data store
let analyticsData: AnalyticsData = {
  totalSystems: 0,
  activeSystems: 0,
  totalPowerUsage: 0,
  averageSystemUptime: 0,
  powerUsageHistory: [],
  systemMetrics: [],
  componentTypeDistribution: {},
  alertsOverTime: []
};

const analyticsSubscribers = new Set<(data: AnalyticsData) => void>();

// Notify all subscribers of analytics data changes
function notifyAnalyticsSubscribers() {
  analyticsSubscribers.forEach(callback => callback({ ...analyticsData }));
}

export class AnalyticsService {
  private static updateInterval: NodeJS.Timeout | null = null;
  private static isRunning = false;

  // Initialize the analytics service
  static initialize() {
    if (!this.isRunning) {
      this.start();
    }
  }

  // Start collecting analytics data
  static start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Analytics service started');
    
    // Update analytics immediately
    this.updateAnalytics();
    
    // Set up interval to update every 30 seconds
    this.updateInterval = setInterval(() => {
      this.updateAnalytics();
    }, 30000);
  }

  // Stop the analytics service
  static stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    console.log('Analytics service stopped');
  }

  // Update analytics data
  static async updateAnalytics() {
    try {
      // This would integrate with your actual system state
      // For now, we'll generate mock data
      const systemsData = await this.collectSystemsData();
      
      analyticsData = {
        totalSystems: systemsData.length,
        activeSystems: systemsData.filter(s => s.isActive).length,
        totalPowerUsage: systemsData.reduce((sum, s) => sum + s.powerUsage, 0),
        averageSystemUptime: systemsData.reduce((sum, s) => sum + s.uptime, 0) / systemsData.length,
        powerUsageHistory: this.generatePowerUsageHistory(systemsData),
        systemMetrics: systemsData.map(s => this.calculateSystemMetrics(s)),
        componentTypeDistribution: this.calculateComponentDistribution(systemsData),
        alertsOverTime: this.generateAlertsOverTime()
      };

      notifyAnalyticsSubscribers();
    } catch (error) {
      console.error('Error updating analytics:', error);
    }
  }

  // Collect systems data (mock implementation)
  private static async collectSystemsData() {
    // This would integrate with your actual system state
    return [
      {
        name: 'SmartGarageDoorSystem',
        isActive: true,
        powerUsage: 150,
        uptime: 98.5,
        components: [
          { type: 'unit', powerUsage: 100 },
          { type: 'sensor', powerUsage: 25 },
          { type: 'actuator', powerUsage: 25 }
        ],
        errorCount: 2
      },
      {
        name: 'SmartLightSystem',
        isActive: true,
        powerUsage: 75,
        uptime: 99.2,
        components: [
          { type: 'unit', powerUsage: 50 },
          { type: 'sensor', powerUsage: 15 },
          { type: 'sensor', powerUsage: 10 }
        ],
        errorCount: 0
      },
      {
        name: 'SmartFireSystem',
        isActive: true,
        powerUsage: 45,
        uptime: 99.8,
        components: [
          { type: 'sensor', powerUsage: 15 },
          { type: 'sensor', powerUsage: 10 },
          { type: 'actuator', powerUsage: 20 }
        ],
        errorCount: 1
      },
      {
        name: 'SmartMicrowaveSystem',
        isActive: false,
        powerUsage: 0,
        uptime: 95.0,
        components: [
          { type: 'unit', powerUsage: 0 },
          { type: 'sensor', powerUsage: 0 }
        ],
        errorCount: 3
      },
      {
        name: 'SmartHubSystem',
        isActive: true,
        powerUsage: 120,
        uptime: 99.9,
        components: [
          { type: 'controller', powerUsage: 80 },
          { type: 'network', powerUsage: 25 },
          { type: 'power', powerUsage: 15 }
        ],
        errorCount: 0
      }
    ];
  }

  // Generate power usage history
  private static generatePowerUsageHistory(systemsData: any[]): PowerUsageData[] {
    const history: PowerUsageData[] = [];
    const now = Date.now();
    
    // Generate data for the last 24 hours (every hour)
    for (let i = 23; i >= 0; i--) {
      const timestamp = now - (i * 60 * 60 * 1000);
      
      systemsData.forEach(system => {
        if (system.isActive) {
          // Add some random variation to make it realistic
          const variation = 0.8 + (Math.random() * 0.4); // 80% to 120% of base usage
          const powerUsage = Math.round(system.powerUsage * variation);
          
          const componentBreakdown: Record<string, number> = {};
          system.components.forEach((comp: any, index: number) => {
            componentBreakdown[`${comp.type}_${index}`] = Math.round(comp.powerUsage * variation);
          });
          
          history.push({
            timestamp,
            systemName: system.name,
            powerUsage,
            componentBreakdown
          });
        }
      });
    }
    
    return history;
  }

  // Calculate system metrics
  private static calculateSystemMetrics(systemData: any): SystemMetrics {
    const recentHistory = analyticsData.powerUsageHistory
      .filter(h => h.systemName === systemData.name)
      .slice(-24); // Last 24 hours
    
    const powerUsages = recentHistory.map(h => h.powerUsage);
    
    return {
      systemName: systemData.name,
      totalPowerUsage: systemData.powerUsage,
      averagePowerUsage: powerUsages.length > 0 ? 
        Math.round(powerUsages.reduce((sum, p) => sum + p, 0) / powerUsages.length) : 0,
      peakPowerUsage: powerUsages.length > 0 ? Math.max(...powerUsages) : 0,
      uptime: systemData.uptime,
      errorCount: systemData.errorCount,
      lastUpdated: Date.now()
    };
  }

  // Calculate component type distribution
  private static calculateComponentDistribution(systemsData: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    systemsData.forEach(system => {
      system.components.forEach((comp: any) => {
        distribution[comp.type] = (distribution[comp.type] || 0) + 1;
      });
    });
    
    return distribution;
  }

  // Generate alerts over time data
  private static generateAlertsOverTime() {
    const alertsHistory = [];
    const now = Date.now();
    
    // Generate data for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const timestamp = now - (i * 24 * 60 * 60 * 1000);
      
      // Simulate different alert levels throughout the week
      const criticalCount = Math.floor(Math.random() * 3);
      const errorCount = Math.floor(Math.random() * 5);
      const warningCount = Math.floor(Math.random() * 8);
      const infoCount = Math.floor(Math.random() * 12);
      
      alertsHistory.push(
        { timestamp, count: criticalCount, level: 'critical' },
        { timestamp, count: errorCount, level: 'error' },
        { timestamp, count: warningCount, level: 'warning' },
        { timestamp, count: infoCount, level: 'info' }
      );
    }
    
    return alertsHistory;
  }

  // Get current analytics data
  static getAnalyticsData(): AnalyticsData {
    return { ...analyticsData };
  }

  // Subscribe to analytics data changes
  static subscribeToAnalytics(callback: (data: AnalyticsData) => void): () => void {
    analyticsSubscribers.add(callback);
    
    // Send current data immediately
    callback({ ...analyticsData });
    
    return () => {
      analyticsSubscribers.delete(callback);
    };
  }

  // Get power usage for a specific system
  static getSystemPowerUsage(systemName: string): PowerUsageData[] {
    return analyticsData.powerUsageHistory.filter(h => h.systemName === systemName);
  }

  // Get total power usage over time
  static getTotalPowerUsageOverTime(): Array<{ timestamp: number; totalPower: number }> {
    const timeGroups: Record<number, number> = {};
    
    analyticsData.powerUsageHistory.forEach(entry => {
      const hourTimestamp = Math.floor(entry.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
      timeGroups[hourTimestamp] = (timeGroups[hourTimestamp] || 0) + entry.powerUsage;
    });
    
    return Object.entries(timeGroups)
      .map(([timestamp, totalPower]) => ({
        timestamp: parseInt(timestamp),
        totalPower
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  // Get service status
  static getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdated: analyticsData.systemMetrics[0]?.lastUpdated || 0,
      dataPoints: analyticsData.powerUsageHistory.length
    };
  }
}

export default AnalyticsService;

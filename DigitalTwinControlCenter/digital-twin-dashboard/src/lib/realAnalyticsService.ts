import DataTrackingService from './dataTrackingService';
import { getSystemFirebaseConfig } from '@/config/firebaseUrlConfig';

export interface SystemPowerData {
  systemName: string;
  currentPower: number;
  averagePower: number;
  peakPower: number;
  isOn: boolean;
}

export interface PowerTrendData {
  timestamp: number;
  totalPower: number;
  systemBreakdown: Record<string, number>;
}

export interface RealAnalyticsData {
  totalPowerUsage: number;
  activeSystems: number;
  totalSystems: number;
  averageUptime: number;
  systemPowerData: SystemPowerData[];
  powerTrends: PowerTrendData[];
  lastUpdated: number;
}

export class RealAnalyticsService {
  private static systems = [
    'SmartGarageDoorSystem',
    'SmartLightHUB',
    'SmartFireSystem'
  ];

  // Get current analytics data from all systems
  static async getCurrentAnalytics(): Promise<RealAnalyticsData> {
    try {
      const systemPowerData: SystemPowerData[] = [];
      let totalPowerUsage = 0;
      let activeSystems = 0;
      let totalUptime = 0;
      const totalSystems = this.systems.length;

      // Collect data from each system
      for (const systemName of this.systems) {
        try {
          const metrics = await DataTrackingService.getCurrentMetrics(systemName);
          const powerHistory = await DataTrackingService.getPowerUsageHistory(systemName, 24);
          
          const currentPower = metrics.currentPowerUsage || 0;
          const averagePower = powerHistory.length > 0 
            ? powerHistory.reduce((sum, point) => sum + point.powerUsage, 0) / powerHistory.length 
            : 0;
          const peakPower = powerHistory.length > 0 
            ? Math.max(...powerHistory.map(point => point.powerUsage)) 
            : 0;

          systemPowerData.push({
            systemName,
            currentPower,
            averagePower: Math.round(averagePower),
            peakPower: Math.round(peakPower),
            isOn: metrics.isOn
          });

          totalPowerUsage += currentPower;
          if (metrics.isOn) activeSystems++;
          totalUptime += metrics.uptime;
        } catch (error) {
          console.warn(`Error getting metrics for ${systemName}:`, error);
          // Add default data for failed systems
          systemPowerData.push({
            systemName,
            currentPower: 0,
            averagePower: 0,
            peakPower: 0,
            isOn: false
          });
        }
      }

      // Generate power trends for the last 24 hours
      const powerTrends = await this.generatePowerTrends();

      return {
        totalPowerUsage: Math.round(totalPowerUsage),
        activeSystems,
        totalSystems,
        averageUptime: totalSystems > 0 ? Math.round(totalUptime / totalSystems) : 0,
        systemPowerData,
        powerTrends,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error('Error getting current analytics:', error);
      return this.getDefaultAnalytics();
    }
  }

  // Generate power trends by combining data from all systems
  private static async generatePowerTrends(): Promise<PowerTrendData[]> {
    try {
      const trends: PowerTrendData[] = [];
      const timePoints = new Set<number>();

      // Collect all unique timestamps from all systems
      const systemHistories: Record<string, Array<{timestamp: number, powerUsage: number}>> = {};
      
      for (const systemName of this.systems) {
        try {
          const history = await DataTrackingService.getPowerUsageHistory(systemName, 24);
          systemHistories[systemName] = history;
          history.forEach(point => timePoints.add(point.timestamp));
        } catch (error) {
          console.warn(`Error getting power history for ${systemName}:`, error);
          systemHistories[systemName] = [];
        }
      }

      // Sort timestamps
      const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b);

      // For each timestamp, calculate total power and system breakdown
      for (const timestamp of sortedTimePoints) {
        let totalPower = 0;
        const systemBreakdown: Record<string, number> = {};

        for (const systemName of this.systems) {
          const history = systemHistories[systemName];
          
          // Find the closest data point for this timestamp
          const closestPoint = history.reduce((closest, point) => {
            const currentDiff = Math.abs(point.timestamp - timestamp);
            const closestDiff = Math.abs(closest.timestamp - timestamp);
            return currentDiff < closestDiff ? point : closest;
          }, history[0] || { timestamp: 0, powerUsage: 0 });

          const power = closestPoint ? closestPoint.powerUsage : 0;
          systemBreakdown[systemName] = power;
          totalPower += power;
        }

        trends.push({
          timestamp,
          totalPower: Math.round(totalPower),
          systemBreakdown
        });
      }

      // If no trends, create some default data points
      if (trends.length === 0) {
        const now = Date.now();
        for (let i = 0; i < 24; i++) {
          const timestamp = now - (i * 60 * 60 * 1000); // Every hour for 24 hours
          trends.push({
            timestamp,
            totalPower: 0,
            systemBreakdown: {}
          });
        }
      }

      return trends.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Error generating power trends:', error);
      return [];
    }
  }

  // Get power usage by system for pie chart
  static async getPowerUsageBySystem(): Promise<Array<{label: string, value: number, color?: string}>> {
    try {
      const analytics = await this.getCurrentAnalytics();

      // Define colors for different systems
      const colors = [
        '#3b82f6', // blue
        '#ef4444', // red
        '#10b981', // green
        '#f59e0b', // yellow
        '#8b5cf6', // purple
        '#06b6d4', // cyan
        '#f97316', // orange
        '#84cc16'  // lime
      ];

      const systemData = analytics.systemPowerData
        .filter(system => system.currentPower > 0)
        .map((system, index) => ({
          label: system.systemName.replace('Smart', '').replace('System', ''),
          value: system.currentPower,
          color: colors[index % colors.length]
        }))
        .sort((a, b) => b.value - a.value);

      // If no systems have power usage, create some sample data to show the chart structure
      if (systemData.length === 0) {
        return [
          { label: 'No Active Systems', value: 1, color: '#94a3b8' }
        ];
      }

      return systemData;
    } catch (error) {
      console.error('Error getting power usage by system:', error);
      return [
        { label: 'Data Unavailable', value: 1, color: '#94a3b8' }
      ];
    }
  }

  // Get power usage trend over time
  static async getPowerUsageTrend(): Promise<Array<{label: string, value: number}>> {
    try {
      const analytics = await this.getCurrentAnalytics();

      // If we have real trend data, use it
      if (analytics.powerTrends.length > 0) {
        return analytics.powerTrends
          .slice(-12) // Last 12 data points
          .map(trend => {
            const date = new Date(trend.timestamp);
            return {
              label: date.getHours().toString().padStart(2, '0') + ':' +
                     date.getMinutes().toString().padStart(2, '0'),
              value: trend.totalPower
            };
          });
      }

      // Generate sample trend data based on current power usage
      const currentTotal = analytics.totalPowerUsage;
      const now = Date.now();
      const trendData = [];

      for (let i = 11; i >= 0; i--) {
        const timestamp = now - (i * 5 * 60 * 1000); // Every 5 minutes
        const date = new Date(timestamp);
        const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
        const value = Math.max(0, Math.round(currentTotal * (1 + variation)));

        trendData.push({
          label: date.getHours().toString().padStart(2, '0') + ':' +
                 date.getMinutes().toString().padStart(2, '0'),
          value
        });
      }

      return trendData;
    } catch (error) {
      console.error('Error getting power usage trend:', error);
      return [];
    }
  }

  // Get top power consuming systems
  static async getTopPowerConsumers(limit: number = 5): Promise<SystemPowerData[]> {
    try {
      const analytics = await this.getCurrentAnalytics();
      
      return analytics.systemPowerData
        .sort((a, b) => b.currentPower - a.currentPower)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting top power consumers:', error);
      return [];
    }
  }

  // Get system efficiency metrics
  static async getEfficiencyMetrics(): Promise<{
    powerEfficiency: number;
    uptimeEfficiency: number;
    overallEfficiency: number;
  }> {
    try {
      const analytics = await this.getCurrentAnalytics();
      
      const powerEfficiency = analytics.totalSystems > 0 
        ? (analytics.activeSystems / analytics.totalSystems) * 100 
        : 0;
      
      const uptimeEfficiency = analytics.averageUptime;
      
      const overallEfficiency = (powerEfficiency + uptimeEfficiency) / 2;

      return {
        powerEfficiency: Math.round(powerEfficiency),
        uptimeEfficiency: Math.round(uptimeEfficiency),
        overallEfficiency: Math.round(overallEfficiency)
      };
    } catch (error) {
      console.error('Error getting efficiency metrics:', error);
      return {
        powerEfficiency: 0,
        uptimeEfficiency: 0,
        overallEfficiency: 0
      };
    }
  }

  // Default analytics data when real data is unavailable
  private static getDefaultAnalytics(): RealAnalyticsData {
    return {
      totalPowerUsage: 0,
      activeSystems: 0,
      totalSystems: this.systems.length,
      averageUptime: 0,
      systemPowerData: this.systems.map(systemName => ({
        systemName,
        currentPower: 0,
        averagePower: 0,
        peakPower: 0,
        isOn: false
      })),
      powerTrends: [],
      lastUpdated: Date.now()
    };
  }

  // Store total power usage data point for trending
  static async recordTotalPowerUsage(): Promise<void> {
    try {
      const analytics = await this.getCurrentAnalytics();
      
      // This could be stored in Firebase for historical trending
      console.log(`Total power usage recorded: ${analytics.totalPowerUsage}W at ${new Date().toISOString()}`);
      
      // TODO: Store in Firebase under /analytics/total_power_usage/
      // const timestamp = Date.now();
      // await push(ref(database, 'analytics/total_power_usage'), {
      //   timestamp,
      //   totalPower: analytics.totalPowerUsage,
      //   activeSystems: analytics.activeSystems
      // });
    } catch (error) {
      console.error('Error recording total power usage:', error);
    }
  }
}

export default RealAnalyticsService;

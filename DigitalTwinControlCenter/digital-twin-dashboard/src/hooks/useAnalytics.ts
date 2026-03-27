import { useState, useEffect, useCallback } from 'react';
import AnalyticsService, { AnalyticsData, PowerUsageData } from '@/lib/analyticsService';

export function useAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to analytics data on mount
  useEffect(() => {
    const unsubscribe = AnalyticsService.subscribeToAnalytics((data) => {
      setAnalyticsData(data);
      setIsLoading(false);
    });

    // Initialize the service
    AnalyticsService.initialize();

    return unsubscribe;
  }, []);

  // Get power usage for a specific system
  const getSystemPowerUsage = useCallback((systemName: string): PowerUsageData[] => {
    return AnalyticsService.getSystemPowerUsage(systemName);
  }, []);

  // Get total power usage over time
  const getTotalPowerUsageOverTime = useCallback(() => {
    return AnalyticsService.getTotalPowerUsageOverTime();
  }, []);

  // Get service status
  const getStatus = useCallback(() => {
    return AnalyticsService.getStatus();
  }, []);

  // Calculate efficiency metrics
  const getEfficiencyMetrics = useCallback(() => {
    if (!analyticsData) return null;

    const totalPower = analyticsData.totalPowerUsage;
    const activeSystems = analyticsData.activeSystems;
    const averageUptime = analyticsData.averageSystemUptime;

    return {
      powerEfficiency: activeSystems > 0 ? totalPower / activeSystems : 0,
      systemUtilization: (activeSystems / analyticsData.totalSystems) * 100,
      overallHealth: averageUptime,
      totalErrorCount: analyticsData.systemMetrics.reduce((sum, m) => sum + m.errorCount, 0)
    };
  }, [analyticsData]);

  // Get top power consuming systems
  const getTopPowerConsumers = useCallback((limit: number = 5) => {
    if (!analyticsData) return [];

    return analyticsData.systemMetrics
      .sort((a, b) => b.totalPowerUsage - a.totalPowerUsage)
      .slice(0, limit);
  }, [analyticsData]);

  // Get systems with most errors
  const getSystemsWithMostErrors = useCallback((limit: number = 5) => {
    if (!analyticsData) return [];

    return analyticsData.systemMetrics
      .filter(m => m.errorCount > 0)
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, limit);
  }, [analyticsData]);

  // Get power usage trends
  const getPowerUsageTrends = useCallback(() => {
    if (!analyticsData) return null;

    const totalPowerOverTime = getTotalPowerUsageOverTime();
    
    if (totalPowerOverTime.length < 2) return null;

    const recent = totalPowerOverTime.slice(-6); // Last 6 hours
    const older = totalPowerOverTime.slice(-12, -6); // 6 hours before that

    const recentAvg = recent.reduce((sum, p) => sum + p.totalPower, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p.totalPower, 0) / older.length;

    const trend = recentAvg - olderAvg;
    const trendPercentage = olderAvg > 0 ? (trend / olderAvg) * 100 : 0;

    return {
      trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
      changeAmount: Math.abs(trend),
      changePercentage: Math.abs(trendPercentage),
      recentAverage: recentAvg,
      previousAverage: olderAvg
    };
  }, [analyticsData, getTotalPowerUsageOverTime]);

  return {
    analyticsData,
    isLoading,
    getSystemPowerUsage,
    getTotalPowerUsageOverTime,
    getStatus,
    getEfficiencyMetrics,
    getTopPowerConsumers,
    getSystemsWithMostErrors,
    getPowerUsageTrends,
    // Computed values for easy access
    totalSystems: analyticsData?.totalSystems || 0,
    activeSystems: analyticsData?.activeSystems || 0,
    totalPowerUsage: analyticsData?.totalPowerUsage || 0,
    averageUptime: analyticsData?.averageSystemUptime || 0,
    componentDistribution: analyticsData?.componentTypeDistribution || {},
  };
}

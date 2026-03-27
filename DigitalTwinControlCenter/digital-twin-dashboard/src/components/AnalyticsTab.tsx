"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SimpleChart } from "@/components/SimpleChart";
import RealAnalyticsService, { type RealAnalyticsData } from "@/lib/realAnalyticsService";
import {
  Activity,
  Zap,
  TrendingUp,
  AlertTriangle,
  Loader2
} from "lucide-react";

export function AnalyticsTab() {
  const [analyticsData, setAnalyticsData] = useState<RealAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [powerBySystemData, setPowerBySystemData] = useState<Array<{label: string, value: number}>>([]);
  const [powerTrendData, setPowerTrendData] = useState<Array<{label: string, value: number}>>([]);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setIsLoading(true);
        
        // Load all analytics data
        const [analytics, powerBySystem, powerTrend] = await Promise.all([
          RealAnalyticsService.getCurrentAnalytics(),
          RealAnalyticsService.getPowerUsageBySystem(),
          RealAnalyticsService.getPowerUsageTrend()
        ]);

        setAnalyticsData(analytics);
        setPowerBySystemData(powerBySystem);
        setPowerTrendData(powerTrend);
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
    
    // Refresh analytics every 30 seconds
    const interval = setInterval(loadAnalytics, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin mr-3" />
        <span className="text-lg">Loading real-time analytics...</span>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle className="h-8 w-8 mr-3 text-yellow-500" />
        <span className="text-lg">Unable to load analytics data</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Real-time system performance and usage analytics</p>
        </div>
        <Badge variant="outline" className="text-sm">
          Last updated: {new Date(analyticsData.lastUpdated).toLocaleTimeString()}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Systems</p>
                <p className="text-2xl font-bold">{analyticsData.totalSystems}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <Badge variant={analyticsData.activeSystems === analyticsData.totalSystems ? "default" : "secondary"}>
                {analyticsData.activeSystems} active
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Power Usage</p>
                <p className="text-2xl font-bold">{analyticsData.totalPowerUsage}W</p>
              </div>
              <Zap className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="mt-2">
              <Badge variant={analyticsData.totalPowerUsage > 500 ? "destructive" : "default"}>
                {analyticsData.totalPowerUsage > 500 ? "High" : "Normal"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Systems</p>
                <p className="text-2xl font-bold">{analyticsData.activeSystems}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <Badge variant="outline">
                {((analyticsData.activeSystems / analyticsData.totalSystems) * 100).toFixed(0)}% online
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Power Usage by System - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              Power Usage by System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleChart
              title=""
              data={powerBySystemData}
              type="pie"
              unit="W"
              height={280}
              showValues={true}
            />
          </CardContent>
        </Card>

        {/* Power Usage Trend - Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Power Usage Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {powerTrendData.length > 0 ? (
              <SimpleChart
                title=""
                data={powerTrendData}
                type="line"
                unit="W"
                height={280}
                showValues={false}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Collecting trend data...</p>
                  <p className="text-sm">Charts will appear as data is collected</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            System Performance Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analyticsData.systemPowerData.map((system) => (
              <Card key={system.systemName} className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">
                      {system.systemName.replace('Smart', '').replace('System', '')}
                    </h4>
                    <Badge variant={system.isOn ? "default" : "secondary"} className="text-xs">
                      {system.isOn ? "ON" : "OFF"}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current:</span>
                      <span className="font-mono">{system.currentPower}W</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average:</span>
                      <span className="font-mono">{system.averagePower}W</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Peak:</span>
                      <span className="font-mono">{system.peakPower}W</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

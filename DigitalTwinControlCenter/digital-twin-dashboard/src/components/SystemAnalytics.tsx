"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SimpleChart } from "@/components/SimpleChart";
import { SystemDefinition } from "@/config/systemConfig";
import DataTrackingService from "@/lib/dataTrackingService";
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart3,
  PieChart,
  LineChart
} from "lucide-react";

interface SystemAnalyticsProps {
  system: SystemDefinition;
  mode: "real" | "simulated";
}

export function SystemAnalytics({ system, mode }: SystemAnalyticsProps) {
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSystemMetrics = async () => {
      try {
        setIsLoading(true);
        const metrics = await DataTrackingService.getCurrentMetrics(system.name);
        setSystemMetrics(metrics);
      } catch (error) {
        console.error(`Error loading metrics for ${system.name}:`, error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSystemMetrics();

    // Refresh metrics every 30 seconds
    const interval = setInterval(loadSystemMetrics, 30000);

    return () => clearInterval(interval);
  }, [system.name]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 animate-spin mr-3" />
        <span className="text-lg">Loading system analytics...</span>
      </div>
    );
  }

  // Component type distribution (no power data at component level)
  const componentTypeData = system.components.reduce((acc, component) => {
    const type = component.type;
    const existing = acc.find(item => item.label === type);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({
        label: type.charAt(0).toUpperCase() + type.slice(1),
        value: 1
      });
    }
    return acc;
  }, [] as Array<{ label: string; value: number }>);

  // Generate power usage over time from real Firebase data
  const powerOverTimeData = systemMetrics?.powerHistory?.map((dataPoint: any) => {
    const date = new Date(dataPoint.timestamp);
    return {
      label: date.getHours().toString().padStart(2, '0') + ':' +
             date.getMinutes().toString().padStart(2, '0'),
      value: dataPoint.powerUsage || 0
    };
  }) || [];

  // If no power data, show a message
  const hasPowerData = powerOverTimeData.length > 0;

  // System uptime data (current uptime percentage)
  const uptimeData = [{
    label: 'Current',
    value: systemMetrics?.uptime || 0
  }];

  return (
    <div className="space-y-6">
      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Power</p>
                <p className="text-2xl font-bold">{systemMetrics?.currentPowerUsage || 0}W</p>
              </div>
              <Zap className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="mt-2">
              <Badge variant={systemMetrics?.isOn ? "default" : "secondary"} className="text-xs">
                {systemMetrics?.isOn ? "Online" : "Offline"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Uptime (24h)</p>
                <p className="text-2xl font-bold">{systemMetrics?.uptime?.toFixed(1) || '0.0'}%</p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <Badge variant={systemMetrics?.uptime > 95 ? "default" : "destructive"} className="text-xs">
                {systemMetrics?.uptime > 95 ? "Excellent" : "Needs Attention"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Components</p>
                <p className="text-2xl font-bold">{system.components.length}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                {system.components.filter(c => c.type === 'sensor').length} sensors
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p className="text-2xl font-bold">{systemMetrics?.isOn ? "ON" : "OFF"}</p>
              </div>
              <Activity className={`h-8 w-8 ${systemMetrics?.isOn ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <div className="mt-2">
              <Badge variant={systemMetrics?.isOn ? "default" : "secondary"} className="text-xs">
                {systemMetrics?.isOn ? "Running" : "Stopped"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleChart
          title="Component Distribution"
          data={componentTypeData}
          type="pie"
          height={250}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium">Current Power Usage</p>
                  <p className="text-sm text-muted-foreground">Real-time power consumption</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{systemMetrics?.currentPowerUsage || 0}W</p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Zap className="h-3 w-3 mr-1" />
                    Live
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium">System State</p>
                  <p className="text-sm text-muted-foreground">Current operational status</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{systemMetrics?.isOn ? "ONLINE" : "OFFLINE"}</p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Activity className="h-3 w-3 mr-1" />
                    {mode}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6">
        {hasPowerData ? (
          <SimpleChart
            title="Power Usage Trend (Real-time Data)"
            data={powerOverTimeData}
            type="line"
            unit="W"
            height={300}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Power Usage Trend (Real-time Data)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  <p className="text-lg font-medium text-muted-foreground mb-2">
                    Collecting Data...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Power usage data is being tracked. Charts will appear shortly.
                  </p>
                  <Badge variant="outline" className="mt-2">
                    Data points: {powerOverTimeData.length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uptime Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">
                {systemMetrics?.uptime?.toFixed(1) || '0.0'}%
              </div>
              <p className="text-sm text-muted-foreground mb-4">Last 24 Hours</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${systemMetrics?.uptime || 0}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium">Data Points</p>
                  <p className="text-sm text-muted-foreground">Tracking history</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{powerOverTimeData.length}</p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <BarChart3 className="h-3 w-3 mr-1" />
                    Records
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium">Components</p>
                  <p className="text-sm text-muted-foreground">Total system components</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{system.components.length}</p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Activity className="h-3 w-3 mr-1" />
                    Active
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium">Last Updated</p>
                  <p className="text-sm text-muted-foreground">Data freshness</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">
                    {systemMetrics?.lastUpdated ?
                      new Date(systemMetrics.lastUpdated).toLocaleTimeString() :
                      'Never'
                    }
                  </p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    Real-time
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

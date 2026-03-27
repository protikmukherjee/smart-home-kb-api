"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTrackingService from "@/lib/dataTrackingService";
import RealAnalyticsService from "@/lib/realAnalyticsService";
import { Activity, Zap, RefreshCw } from "lucide-react";

export function TestDataTracking() {
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runTests = async () => {
    setIsLoading(true);
    const results: any = {};

    try {
      // Test 1: Initialize data tracking
      console.log("🧪 Test 1: Initialize data tracking");
      DataTrackingService.initialize();
      results.initialization = "✅ Success";

      // Test 2: Get current metrics for a system
      console.log("🧪 Test 2: Get current metrics");
      const metrics = await DataTrackingService.getCurrentMetrics('SmartGarageDoorSystem');
      results.currentMetrics = {
        status: "✅ Success",
        data: metrics
      };

      // Test 3: Get power usage history
      console.log("🧪 Test 3: Get power usage history");
      const history = await DataTrackingService.getPowerUsageHistory('SmartGarageDoorSystem', 1);
      results.powerHistory = {
        status: "✅ Success",
        dataPoints: history.length,
        sample: history.slice(0, 3)
      };

      // Test 4: Test analytics service
      console.log("🧪 Test 4: Test analytics service");
      const analytics = await RealAnalyticsService.getCurrentAnalytics();
      results.analytics = {
        status: "✅ Success",
        totalPower: analytics.totalPowerUsage,
        activeSystems: analytics.activeSystems,
        systemCount: analytics.systemPowerData.length
      };

      // Test 5: Test pie chart data
      console.log("🧪 Test 5: Test pie chart data");
      const pieData = await RealAnalyticsService.getPowerUsageBySystem();
      results.pieChartData = {
        status: "✅ Success",
        dataPoints: pieData.length,
        sample: pieData.slice(0, 3)
      };

      // Test 6: Test trend data
      console.log("🧪 Test 6: Test trend data");
      const trendData = await RealAnalyticsService.getPowerUsageTrend();
      results.trendData = {
        status: "✅ Success",
        dataPoints: trendData.length,
        sample: trendData.slice(0, 3)
      };

    } catch (error) {
      console.error("❌ Test failed:", error);
      results.error = error instanceof Error ? error.message : 'Unknown error';
    }

    setTestResults(results);
    setIsLoading(false);
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Data Tracking Test Results
            </CardTitle>
            <Button onClick={runTests} disabled={isLoading} size="sm">
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Run Tests"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!testResults ? (
            <div className="text-center py-8">
              <Activity className="h-8 w-8 animate-pulse mx-auto mb-4 text-muted-foreground" />
              <p>Running tests...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(testResults).map(([key, value]: [string, any]) => (
                <div key={key} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</h4>
                    <Badge variant={typeof value === 'string' && value.includes('✅') ? 'default' : 'secondary'}>
                      {typeof value === 'string' ? value : value.status || 'Unknown'}
                    </Badge>
                  </div>
                  
                  {typeof value === 'object' && value !== null && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      {Object.entries(value).map(([subKey, subValue]: [string, any]) => (
                        subKey !== 'status' && (
                          <div key={subKey} className="flex justify-between">
                            <span className="capitalize">{subKey.replace(/([A-Z])/g, ' $1')}:</span>
                            <span className="font-mono">
                              {typeof subValue === 'object' ? JSON.stringify(subValue, null, 2) : String(subValue)}
                            </span>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              onClick={() => DataTrackingService.seedInitialData('SmartGarageDoorSystem')}
            >
              Seed Garage Door Data
            </Button>
            <Button 
              variant="outline" 
              onClick={() => DataTrackingService.seedInitialData('SmartLightSystem')}
            >
              Seed Light System Data
            </Button>
            <Button 
              variant="outline" 
              onClick={() => DataTrackingService.startTrackingAllSystems()}
            >
              Start All Tracking
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTrackingService from "@/lib/dataTrackingService";
import { Activity, Database, Zap, Clock } from "lucide-react";

export function DataTrackingDebug() {
  const [trackingStatus, setTrackingStatus] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);

  const systems = [
    'SmartGarageDoorSystem',
    'SmartLightSystem',
    'SmartFireSystem',
    'SmartMicrowaveSystem',
    'SmartTVSystem'
  ];

  const checkTrackingStatus = async () => {
    setIsLoading(true);
    const status: Record<string, any> = {};

    for (const systemName of systems) {
      try {
        const metrics = await DataTrackingService.getCurrentMetrics(systemName);
        const history = await DataTrackingService.getPowerUsageHistory(systemName, 1);
        
        status[systemName] = {
          currentPower: metrics.currentPowerUsage,
          isOn: metrics.isOn,
          uptime: metrics.uptime,
          dataPoints: history.length,
          lastDataPoint: history.length > 0 ? new Date(history[history.length - 1].timestamp).toLocaleTimeString() : 'None',
          isTracking: Object.keys(DataTrackingService['trackingIntervals'] || {}).includes(systemName)
        };
      } catch (error) {
        status[systemName] = {
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    setTrackingStatus(status);
    setIsLoading(false);
  };

  const forceRecordMetrics = async (systemName: string) => {
    try {
      await DataTrackingService['recordSystemMetrics'](systemName);
      console.log(`Manually recorded metrics for ${systemName}`);
      await checkTrackingStatus();
    } catch (error) {
      console.error(`Error recording metrics for ${systemName}:`, error);
    }
  };

  const seedData = async (systemName: string) => {
    try {
      await DataTrackingService.seedInitialData(systemName);
      console.log(`Seeded initial data for ${systemName}`);
      await checkTrackingStatus();
    } catch (error) {
      console.error(`Error seeding data for ${systemName}:`, error);
    }
  };

  useEffect(() => {
    checkTrackingStatus();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(checkTrackingStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Data Tracking Debug</CardTitle>
            <Button onClick={checkTrackingStatus} disabled={isLoading}>
              {isLoading ? <Activity className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systems.map(systemName => {
              const status = trackingStatus[systemName];
              
              return (
                <Card key={systemName} className="border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{systemName.replace('Smart', '').replace('System', '')}</h4>
                      <Badge variant={status?.isTracking ? "default" : "secondary"} className="text-xs">
                        {status?.isTracking ? "Tracking" : "Stopped"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {status?.error ? (
                      <p className="text-red-500 text-xs">{status.error}</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center">
                            <Zap className="h-3 w-3 mr-1" />
                            Power:
                          </span>
                          <span className="font-mono">{status?.currentPower || 0}W</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center">
                            <Activity className="h-3 w-3 mr-1" />
                            Status:
                          </span>
                          <Badge variant={status?.isOn ? "default" : "secondary"} className="text-xs">
                            {status?.isOn ? "ON" : "OFF"}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center">
                            <Database className="h-3 w-3 mr-1" />
                            Data Points:
                          </span>
                          <span className="font-mono">{status?.dataPoints || 0}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            Last Data:
                          </span>
                          <span className="font-mono text-xs">{status?.lastDataPoint || 'None'}</span>
                        </div>
                        
                        <div className="flex gap-1 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs h-6 px-2"
                            onClick={() => forceRecordMetrics(systemName)}
                          >
                            Record
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs h-6 px-2"
                            onClick={() => seedData(systemName)}
                          >
                            Seed
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <p><strong>1. Check Tracking Status:</strong> Green "Tracking" badge means data collection is active</p>
            <p><strong>2. Data Points:</strong> Should increase over time (every 30 seconds)</p>
            <p><strong>3. Record Button:</strong> Manually record current metrics</p>
            <p><strong>4. Seed Button:</strong> Create initial historical data for charts</p>
            <p><strong>5. Change Power in Firebase:</strong> Update power values and watch data points increase</p>
            <p><strong>6. Check Analytics:</strong> Go to SystemCard → Analytics tab to see charts</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

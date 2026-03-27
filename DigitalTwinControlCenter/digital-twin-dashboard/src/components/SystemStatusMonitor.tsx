"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { SystemDefinition } from "@/config/systemConfig";
import { useReasoningService } from "@/hooks/useReasoningService";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  Wifi,
  Thermometer,
  Activity,
  Bell,
  BellOff,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Info
} from "lucide-react";

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  uptime: number;
  lastUpdate: number;
  componentHealth: Record<string, {
    status: 'online' | 'offline' | 'error' | 'warning';
    lastSeen: number;
    errorCount: number;
  }>;
}

interface SystemAlert {
  id: string;
  systemName: string;
  component: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

interface SystemStatusMonitorProps {
  systems: SystemDefinition[];
  systemStates: Record<string, any>;
  mode: "real" | "simulated";
  onRefreshSystem: (systemName: string) => void;
}

export function SystemStatusMonitor({ 
  systems, 
  systemStates, 
  mode, 
  onRefreshSystem 
}: SystemStatusMonitorProps) {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [systemHealth, setSystemHealth] = useState<Record<string, SystemHealth>>({});
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Monitor system health and generate alerts
  useEffect(() => {
    const checkSystemHealth = () => {
      const newHealth: Record<string, SystemHealth> = {};
      const newAlerts: SystemAlert[] = [];

      systems.forEach(system => {
        const systemState = systemStates[system.name];
        if (!systemState) return;

        const componentHealth: Record<string, any> = {};
        let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
        let errorCount = 0;

        // Check each component
        Object.entries(systemState.components || {}).forEach(([componentName, componentState]: [string, any]) => {
          let status: 'online' | 'offline' | 'error' | 'warning' = 'offline';
          let componentErrorCount = 0;

          // Determine component status
          if (componentState.error || componentState.isError) {
            status = 'error';
            componentErrorCount++;
            errorCount++;
            
            newAlerts.push({
              systemName: system.name,
              id: `${system.name}-${componentName}-error-${Date.now()}`,
              type: 'error',
              component: `${system.name}/${componentName}`,
              message: `Component error detected`,
              timestamp: Date.now(),
              acknowledged: false
            });
          } else if (componentState.isOn || componentState.isActive || componentState.working) {
            status = 'online';
          } else if (systemState.isOn) {
            status = 'warning';
            
            newAlerts.push({
              systemName: system.name,
              id: `${system.name}-${componentName}-warning-${Date.now()}`,
              type: 'warning',
              component: `${system.name}/${componentName}`,
              message: `Component not responding while system is on`,
              timestamp: Date.now(),
              acknowledged: false
            });
          }

          // Check for specific component issues
          if (componentName === 'GarageDoor_Unit' && componentState.block) {
            newAlerts.push({
              systemName: system.name,
              id: `${system.name}-${componentName}-blocked-${Date.now()}`,
              type: 'warning',
              component: `${system.name}/${componentName}`,
              message: `Garage door is blocked`,
              timestamp: Date.now(),
              acknowledged: false
            });
          }

          if (componentName === 'Network_Component' && !componentState.wiFi_connection && !componentState.connection) {
            newAlerts.push({
              systemName: system.name,
              id: `${system.name}-${componentName}-network-${Date.now()}`,
              type: 'error',
              component: `${system.name}/${componentName}`,
              message: `Network connection lost`,
              timestamp: Date.now(),
              acknowledged: false
            });
          }

          if (componentState.temp_value > 80) {
            newAlerts.push({
              systemName: system.name,
              id: `${system.name}-${componentName}-temp-${Date.now()}`,
              type: 'warning',
              component: `${system.name}/${componentName}`,
              message: `High temperature detected: ${componentState.temp_value}°C`,
              timestamp: Date.now(),
              acknowledged: false
            });
          }

          if (componentState.power_total > 1000) {
            newAlerts.push({
              systemName: system.name,
              id: `${system.name}-${componentName}-power-${Date.now()}`,
              type: 'warning',
              component: `${system.name}/${componentName}`,
              message: `High power consumption: ${componentState.power_total}W`,
              timestamp: Date.now(),
              acknowledged: false
            });
          }

          componentHealth[componentName] = {
            status,
            lastSeen: Date.now(),
            errorCount: componentErrorCount
          };
        });

        // Determine overall system health
        if (errorCount > 0) {
          overallHealth = 'critical';
        } else if (!systemState.isOn) {
          overallHealth = 'warning';
        }

        newHealth[system.name] = {
          overall: overallHealth,
          uptime: systemState.lastUpdated ? Date.now() - systemState.lastUpdated : 0,
          lastUpdate: systemState.lastUpdated || Date.now(),
          componentHealth
        };
      });

      setSystemHealth(newHealth);
      
      // Only add new alerts if alerts are enabled
      if (alertsEnabled) {
        setAlerts(prev => {
          const existingIds = new Set(prev.map(alert => alert.id));
          const uniqueNewAlerts = newAlerts.filter(alert => !existingIds.has(alert.id));
          return [...uniqueNewAlerts, ...prev].slice(0, 50); // Keep last 50 alerts
        });
      }
    };

    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [systems, systemStates, alertsEnabled]);

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  const refreshAllSystems = () => {
    systems.forEach(system => onRefreshSystem(system.name));
    setLastRefresh(Date.now());
  };

  const getHealthIcon = (health: 'healthy' | 'warning' | 'critical') => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getHealthBadgeVariant = (health: 'healthy' | 'warning' | 'critical') => {
    switch (health) {
      case 'healthy':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'critical':
        return 'destructive';
    }
  };

  const getAlertIcon = (type: 'error' | 'warning' | 'info' | 'critical') => {
    switch (type) {
      case 'error':
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged);
  const criticalSystems = Object.entries(systemHealth).filter(([_, health]) => health.overall === 'critical');
  const warningSystems = Object.entries(systemHealth).filter(([_, health]) => health.overall === 'warning');

  return (
    <div className="space-y-6">
      {/* Overall Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>System Status Monitor</span>
              </CardTitle>
              <CardDescription>
                Real-time monitoring of all connected systems
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAlertsEnabled(!alertsEnabled)}
              >
                {alertsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                {alertsEnabled ? 'Alerts On' : 'Alerts Off'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshAllSystems}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {systems.length - criticalSystems.length - warningSystems.length}
              </div>
              <div className="text-sm text-muted-foreground">Healthy Systems</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">
                {warningSystems.length}
              </div>
              <div className="text-sm text-muted-foreground">Warning Systems</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {criticalSystems.length}
              </div>
              <div className="text-sm text-muted-foreground">Critical Systems</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {unacknowledgedAlerts.length}
              </div>
              <div className="text-sm text-muted-foreground">Active Alerts</div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-muted-foreground">
            Last refresh: {new Date(lastRefresh).toLocaleTimeString()} | 
            Mode: {mode === "real" ? "Real System Data" : "Simulated Data"}
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      {unacknowledgedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span>Active Alerts ({unacknowledgedAlerts.length})</span>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={clearAllAlerts}>
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unacknowledgedAlerts.slice(0, 10).map(alert => (
                <Alert key={alert.id} variant={alert.type === 'error' ? 'destructive' : 'default'}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getAlertIcon(alert.type)}
                      <div>
                        <div className="font-medium">{alert.component}</div>
                        <AlertDescription>{alert.message}</AlertDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {systems.map(system => {
          const health = systemHealth[system.name];
          const systemState = systemStates[system.name];
          
          if (!health || !systemState) return null;

          return (
            <Card key={system.name}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{system.displayName}</CardTitle>
                  <div className="flex items-center space-x-2">
                    {getHealthIcon(health.overall)}
                    <Badge variant={getHealthBadgeVariant(health.overall)}>
                      {health.overall}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>Uptime: {Math.round(health.uptime / 1000 / 60)}m</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Activity className="h-3 w-3" />
                    <span>
                      {Object.values(health.componentHealth).filter(c => c.status === 'online').length}/
                      {Object.keys(health.componentHealth).length} Online
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium">Component Status</div>
                  {Object.entries(health.componentHealth).map(([componentName, componentHealth]) => (
                    <div key={componentName} className="flex items-center justify-between text-xs">
                      <span>{componentName.replace('_', ' ')}</span>
                      <Badge 
                        variant={
                          componentHealth.status === 'online' ? 'default' :
                          componentHealth.status === 'warning' ? 'secondary' :
                          componentHealth.status === 'error' ? 'destructive' : 'outline'
                        }
                        className="text-xs"
                      >
                        {componentHealth.status}
                      </Badge>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRefreshSystem(system.name)}
                  className="w-full"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh System
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

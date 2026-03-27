"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SystemDefinition } from "@/config/systemConfig";
import { ComponentCard } from "@/components/ComponentCard";
import { SystemAnalytics } from "@/components/SystemAnalytics";
import { useSystem } from "@/hooks/useSystem";
import SystemService from "@/lib/systemService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wifi,
  Battery,
  Home,
  Shield,
  Thermometer,
  Settings,
  AlertCircle,
  Lightbulb,
  Tv,
  Microwave,
  Flame,
  TrafficCone
} from "lucide-react";

interface SystemCardProps {
  system: SystemDefinition;
  mode: "real" | "simulated";
}

const SYSTEM_ICONS = {
  SmartGarageDoorSystem: Home,
  SmartLightSystem: Lightbulb,
  SmartTVSystem: Tv,
  SmartMicrowaveSystem: Microwave,
  SmartFireSystem: Flame,
  SmartTrafficLightSystem: TrafficCone,
  SmartHubSystem: Settings,
  SmartLightHUB: Lightbulb,
  SmartHub: Home,
  SecuritySystem: Shield,
  ClimateControl: Thermometer,
};

export function SystemCard({ system, mode }: SystemCardProps) {
  const {
    systemState,
    error,
    executeCommand,
    getComponentState,
    clearError
  } = useSystem({ systemName: system.name, mode, systemDefinition: system });
  

  const IconComponent = SYSTEM_ICONS[system.name as keyof typeof SYSTEM_ICONS] || Settings;

  const handleSystemToggle = async (isOn: boolean) => {
    try {
      // Use SystemService to update the system state
      await SystemService.updateSystemState(system.name, { isOn });
      console.log(`System ${system.name} toggled to ${isOn}`);
    } catch (error) {
      console.error(`Error toggling system ${system.name}:`, error);
    }
  };



  // Get components by type for better organization
  const sensors = system.components.filter(comp => comp.type === 'sensor');
  const actuators = system.components.filter(comp => comp.type === 'actuator');
  const controllers = system.components.filter(comp => comp.type === 'controller');
  const units = system.components.filter(comp => comp.type === 'unit');
  const systemComponents = system.components.filter(comp => 
    ['network', 'power', 'temperature'].includes(comp.type)
  );

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl transition-all duration-300 ${
              systemState.isOn 
                ? 'bg-primary/20 shadow-lg shadow-primary/25' 
                : 'bg-muted/50'
            }`}>
              <IconComponent className={`h-8 w-8 transition-colors duration-300 ${
                systemState.isOn ? 'text-primary' : 'text-muted-foreground'
              }`} />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold">{system.displayName}</CardTitle>
              <CardDescription className="text-sm">{system.description}</CardDescription>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {error && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
              >
                <AlertCircle className="h-4 w-4" />
              </Button>
            )}
            <Badge 
              variant={systemState.components['Network_Component']?.wiFi_connection ? "default" : "secondary"}
              className="px-3 py-1 text-sm font-medium"
            >
              {systemState.components['Network_Component']?.wiFi_connection ? "Online" : "Offline"}
            </Badge>
          </div>
        </div>

        {/* System Status Indicators */}
        {systemComponents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {systemComponents.map(component => {
                const componentState = getComponentState(component.name);
                
                if (component.type === 'network') {
                  return (
                    <div key={component.name} className="flex items-center space-x-2 p-2 bg-muted/30 rounded-lg">
                      <Wifi className={`h-4 w-4 ${
                        componentState.wiFi_connection || componentState.connection 
                          ? 'text-green-500' 
                          : 'text-red-500'
                      }`} />
                      <span className="text-sm font-medium">Network</span>
                    </div>
                  );
                }
                
                if (component.type === 'power') {
                  return (
                    <div key={component.name} className="flex items-center space-x-2 p-2 bg-muted/30 rounded-lg">
                      <Battery className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">
                        Power: {componentState.total || componentState.power_total || 0}W
                      </span>
                    </div>
                  );
                }
                
                if (component.type === 'temperature') {
                  return (
                    <div key={component.name} className="flex items-center space-x-2 p-2 bg-muted/30 rounded-lg">
                      <Thermometer className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">
                        {componentState.temp_value || componentState.temperature || 0}°C
                      </span>
                    </div>
                  );
                }
                
                return null;
              })}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        <Tabs defaultValue="components" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="components" className="space-y-4 mt-4">
            {/* Main Units */}
            {units.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Main Units
                </h4>
                <div className="grid gap-3">
                  {units.map(component => (
                    <ComponentCard
                      key={component.name}
                      component={component}
                      componentState={getComponentState(component.name)}
                      onExecuteCommand={(command, params) => executeCommand(component.name, command, params)}
                      mode={mode}
                      systemIsOn={systemState.isOn}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Controllers */}
            {controllers.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Controllers
                </h4>
                <div className="grid gap-3">
                  {controllers.map(component => (
                    <ComponentCard
                      key={component.name}
                      component={component}
                      componentState={getComponentState(component.name)}
                      onExecuteCommand={(command, params) => executeCommand(component.name, command, params)}
                      mode={mode}
                      systemIsOn={systemState.isOn}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Sensors */}
            {sensors.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Sensors
                </h4>
                <div className="grid gap-3">
                  {sensors.map(component => (
                    <ComponentCard
                      key={component.name}
                      component={component}
                      componentState={getComponentState(component.name)}
                      onExecuteCommand={(command, params) => executeCommand(component.name, command, params)}
                      mode={mode}
                      systemIsOn={systemState.isOn}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Actuators */}
            {actuators.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Actuators
                </h4>
                <div className="grid gap-3">
                  {actuators.map(component => (
                    <ComponentCard
                      key={component.name}
                      component={component}
                      componentState={getComponentState(component.name)}
                      onExecuteCommand={(command, params) => executeCommand(component.name, command, params)}
                      mode={mode}
                      systemIsOn={systemState.isOn}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="controls" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="system-toggle" className="text-sm font-medium">
                    System Power
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Turn the entire system on or off
                  </p>
                </div>
                <Switch
                  id="system-toggle"
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-white"
                  checked={systemState.isOn}
                  onCheckedChange={handleSystemToggle}
                />
              </div>

              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium mb-2">System Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Components:</span>
                    <span>{system.components.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mode:</span>
                    <span className="capitalize">{mode}</span>
                  </div>
                  {systemState.lastUpdated && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Updated:</span>
                      <span>{new Date(systemState.lastUpdated).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 mt-4">
            <SystemAnalytics system={system} mode={mode} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComponentDefinition } from "@/config/systemConfig";
import {
  Activity,
  Zap,
  Gauge,
  DoorClosed,
  Lightbulb,
  Volume2,
  Thermometer,
  Flame,
  Car,
  Microwave,
  Settings,
  Cpu,
  Wifi,
  Battery,
  Square
} from "lucide-react";

interface ComponentCardProps {
  component: ComponentDefinition;
  componentState: any;
  mode: "real" | "simulated";
  onExecuteCommand: (command: string, params?: any) => void;
  systemIsOn: boolean; // Add system state to disable buttons when system is off
}

const COMPONENT_ICONS = {
  'GarageDoor_Unit': DoorClosed,
  'UltraSonic_Sensor': Activity,
  'Motion_Sensor': Activity,
  'LEDLight_Unit': Lightbulb,
  'TV_Unit': Volume2,
  'Microwave_Unit': Microwave,
  'Smoke_Sensor': Flame,
  'Heat_Sensor': Thermometer,
  'Vehicle_Sensor': Car,
  'TrafficLight_Unit': Lightbulb,
  'Alarm_Unit': Volume2,
  'Sprinkler_System': Activity,
  'Button_Component': Square,
  'Door_Sensor': DoorClosed,
  'Brightness_Sensor': Lightbulb,
  'Timer_Component': Activity,
  'Remote_Control': Settings,
  'HUB_Component': Settings,
  'Controller_Component': Settings,
  'Network_Component': Wifi,
  'Power_Component': Battery,
  'DeviceTemp_Component': Thermometer,
  'System1_Component': Cpu,
  'System2_Component': Cpu,
};

export function ComponentCard({ component, componentState, mode, onExecuteCommand, systemIsOn }: ComponentCardProps) {
  const IconComponent = COMPONENT_ICONS[component.name as keyof typeof COMPONENT_ICONS] ||
    (component.type === 'sensor' ? Activity :
     component.type === 'actuator' ? Zap :
     component.type === 'controller' ? Settings :
     component.type === 'unit' ? Cpu :
     component.type === 'network' ? Wifi :
     component.type === 'power' ? Battery :
     component.type === 'temperature' ? Thermometer : Gauge);

  // State for sensor data inputs (simulation mode only)
  const [sensorInputs, setSensorInputs] = useState<Record<string, any>>({});

  const handleAction = (action: string, params?: any) => {
    onExecuteCommand(action, params);
  };

  const handleSensorDataSubmit = (property: string, value: any) => {
    // Call the onExecuteCommand with sensor data
    onExecuteCommand('setSensorData', { property, value });
  };

  const renderPropertyValue = (property: string, value: any) => {
    if (typeof value === 'boolean') {
      return (
        <div key={property} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
          <Label className="text-sm font-medium capitalize">
            {property.replace(/_/g, ' ')}
          </Label>
          <Badge variant={value ? "default" : "secondary"} className="text-xs">
            {value ? "ON" : "OFF"}
          </Badge>
        </div>
      );
    }

    if (typeof value === 'number') {
      return (
        <div key={property} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
          <Label className="text-sm font-medium capitalize">
            {property.replace(/_/g, ' ')}
          </Label>
          <Badge variant="outline" className="font-mono text-xs">
            {value}
          </Badge>
        </div>
      );
    }

    if (typeof value === 'string' || value !== null) {
      return (
        <div key={property} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
          <Label className="text-sm font-medium capitalize">
            {property.replace(/_/g, ' ')}
          </Label>
          <Badge variant="outline" className="text-xs">
            {value || 'N/A'}
          </Badge>
        </div>
      );
    }

    return null;
  };

  const renderActionButtons = () => {
    if (!component.actions || component.actions.length === 0) {
      return null;
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Actions
          </Label>
          {!systemIsOn && (
            <Badge variant="secondary" className="text-xs">
              System Off
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {component.actions.map(action => (
            <Button
              key={action}
              variant="outline"
              size="sm"
              onClick={() => handleAction(action)}
              disabled={!systemIsOn}
              className={`text-xs h-8 ${!systemIsOn ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {action.replace(/^raise/, '').replace(/_/g, ' ')}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const getComponentStatus = () => {
    if (componentState.isOn !== undefined) return componentState.isOn;
    if (componentState.isActive !== undefined) return componentState.isActive;
    if (componentState.isRunning !== undefined) return componentState.isRunning;
    if (componentState.working !== undefined) return componentState.working;
    if (componentState.connection !== undefined) return componentState.connection;
    if (componentState.wiFi_connection !== undefined) return componentState.wiFi_connection;
    return null;
  };

  const status = getComponentStatus();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg transition-colors ${
              status === true ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
              status === false ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
              'bg-muted text-muted-foreground'
            }`}>
              <IconComponent className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">
                {component.name.replace(/_/g, ' ')}
              </CardTitle>
              <p className="text-xs text-muted-foreground capitalize">
                {component.type}
              </p>
            </div>
          </div>
          
          {status !== null && (
            <Badge 
              variant={status ? "default" : "secondary"}
              className="text-xs"
            >
              {status ? "Active" : "Inactive"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Properties */}
        {Object.keys(componentState).length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Properties
              </Label>
              <Badge variant="outline" className="text-xs">
                🔴 Live
              </Badge>
            </div>
            <div className="space-y-2">
              {Object.entries(componentState).map(([property, value]) =>
                renderPropertyValue(property, value)
              )}
            </div>
          </div>
        )}

        {/* Sensor Data Controls (Simulation Mode Only) */}
        {mode === 'simulated' && component.type === 'sensor' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Sensor Data
              </Label>
              <Badge variant="secondary" className="text-xs">
                🎛️ Controls
              </Badge>
            </div>
            <div className="space-y-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
              {/* Distance input for UltraSonic_Sensor */}
              {/* {component.name === 'UltraSonic_Sensor' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Distance (cm)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Enter distance..."
                      value={sensorInputs.distance || ''}
                      onChange={(e) => setSensorInputs(prev => ({ ...prev, distance: e.target.value }))}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSensorDataSubmit('value', parseFloat(sensorInputs.distance) || 0)}
                      disabled={!sensorInputs.distance}
                    >
                      Set
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current: {componentState.environmentData || componentState.distance || 0} cm
                  </p>
                </div>
              )} */}

              {/* Generic sensor data input for other sensors */}
              {component.type === 'sensor' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Environment Data</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter sensor data..."
                      value={sensorInputs.environmentData || ''}
                      onChange={(e) => setSensorInputs(prev => ({ ...prev, environmentData: e.target.value }))}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSensorDataSubmit('environmentData', sensorInputs.environmentData)}
                      disabled={!sensorInputs.environmentData}
                    >
                      Set
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onExecuteCommand('runCycle')}
                  className="w-full"
                >
                  🔄 Run Cycle
                </Button>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Run a statechart cycle to process sensor data
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {renderActionButtons()}

        {/* Mode indicator */}
        <div className="pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <Badge variant="outline" className="text-xs">
              {mode}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

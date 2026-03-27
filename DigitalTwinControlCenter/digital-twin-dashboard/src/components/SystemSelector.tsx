"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SystemDefinition } from "@/config/systemConfig";
import {
  Home,
  Shield,
  Thermometer,
  Settings,
  Activity,
  Cpu,
  Zap
} from "lucide-react";

interface SystemSelectorProps {
  onSystemsSelected: (systems: string[]) => void;
  mode: "real" | "simulated";
  systems: SystemDefinition[];
}

const SYSTEM_ICONS = {
  SmartHub: Home,
  SecuritySystem: Shield,
  ClimateControl: Thermometer,
};

function getComponentsByType(system: SystemDefinition, type: SystemDefinition["components"][number]["type"]) {
  return system.components.filter((component) => component.type === type);
}

export function SystemSelector({ onSystemsSelected, mode, systems = [] }: SystemSelectorProps) {
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);

  const toggleSystem = (systemName: string) => {
    setSelectedSystems(prev => 
      prev.includes(systemName)
        ? prev.filter(s => s !== systemName)
        : [...prev, systemName]
    );
  };

  const handleContinue = () => {
    if (selectedSystems.length > 0) {
      onSystemsSelected(selectedSystems);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {systems.map((system) => {
          const IconComponent = SYSTEM_ICONS[system.name as keyof typeof SYSTEM_ICONS] || Settings;
          const isSelected = selectedSystems.includes(system.name);
          const sensors = getComponentsByType(system, 'sensor');
          const actuators = getComponentsByType(system, 'actuator');
          const controllers = getComponentsByType(system, 'controller');

          return (
            <Card
              key={system.name}
              className={`cursor-pointer border-ink/10 bg-white/90 transition ${
                isSelected
                  ? 'border-cobalt/50 bg-cobalt/5'
                  : 'hover:border-ink/25 hover:bg-white'
              }`}
              onClick={() => toggleSystem(system.name)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`rounded-lg p-2 ${isSelected ? 'bg-cobalt/15' : 'bg-mist'}`}>
                      <IconComponent className={`h-6 w-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <CardTitle className={`text-lg ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {system.displayName}
                    </CardTitle>
                  </div>
                  {isSelected && (
                    <Badge variant="default" className="bg-primary/20 text-primary border-primary/50">
                      ✓ Selected
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-muted-foreground">{system.description}</CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {sensors.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <Activity className="h-3 w-3" />
                        <span className="text-xs text-muted-foreground">
                          {sensors.length} Sensor{sensors.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {actuators.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <Zap className="h-3 w-3" />
                        <span className="text-xs text-muted-foreground">
                          {actuators.length} Actuator{actuators.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {controllers.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <Cpu className="h-3 w-3" />
                        <span className="text-xs text-muted-foreground">
                          {controllers.length} Controller{controllers.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    <strong>Components:</strong> {system.components.slice(0, 3).map(c => c.name.replace('_', ' ')).join(', ')}
                    {system.components.length > 3 && ` +${system.components.length - 3} more`}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedSystems.length > 0 && (
        <div className="flex flex-col items-center space-y-6 rounded-2xl border border-cobalt/20 bg-cobalt/5 p-8">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4 text-primary">
              {selectedSystems.length} System{selectedSystems.length > 1 ? 's' : ''} Selected
            </h3>
            <div className="flex flex-wrap gap-3 justify-center mb-6">
              {selectedSystems.map(systemName => {
                const system = systems.find((entry) => entry.name === systemName);
                return (
                  <Badge
                    key={systemName}
                    variant="secondary"
                    className="bg-primary/20 text-primary border-primary/50 px-3 py-1"
                  >
                    {system?.displayName || systemName}
                  </Badge>
                );
              })}
            </div>
            <p className="text-muted-foreground mb-6 text-lg">
              Your dashboard will be configured for <span className="text-primary font-semibold">{mode}</span> mode
              with the selected systems.
            </p>
          </div>

          <Button
            onClick={handleContinue}
            size="lg"
            variant="default"
            className="px-8"
          >
            🚀 Launch Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  getReasoningConfig, 
  updateModelConfig, 
  toggleModel, 
  getModelsByPriority,
  type ReasoningModelConfig 
} from "@/config/reasoningConfig";
import {
  Settings,
  Brain,
  Zap,
  Shield,
  Wrench,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowLeft,
  Save,
  RefreshCw
} from "lucide-react";

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [config, setConfig] = useState(getReasoningConfig());
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getModelIcon = (modelId: string) => {
    switch (modelId) {
      case 'power-anomaly-detector':
        return <Zap className="h-4 w-4" />;
      case 'system-health-monitor':
        return <CheckCircle className="h-4 w-4" />;
      case 'predictive-maintenance':
        return <Wrench className="h-4 w-4" />;
      case 'security-analyzer':
        return <Shield className="h-4 w-4" />;
      case 'efficiency-optimizer':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  const handleModelToggle = (modelId: string) => {
    toggleModel(modelId);
    setConfig(getReasoningConfig());
    setHasChanges(true);
  };

  const handleIntervalChange = (modelId: string, interval: number) => {
    updateModelConfig(modelId, { interval: interval * 60 * 1000 }); // Convert minutes to milliseconds
    setConfig(getReasoningConfig());
    setHasChanges(true);
  };

  const handlePriorityChange = (modelId: string, priority: number) => {
    updateModelConfig(modelId, { priority });
    setConfig(getReasoningConfig());
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // Simulate save operation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setHasChanges(false);
    setIsSaving(false);
    
    console.log('Settings saved:', config);
  };

  const formatInterval = (milliseconds: number): number => {
    return Math.floor(milliseconds / (60 * 1000)); // Convert to minutes
  };

  const sortedModels = getModelsByPriority();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <Settings className="h-6 w-6 mr-2" />
              Settings
            </h1>
            <p className="text-muted-foreground">Configure reasoning models and system settings</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {hasChanges && (
            <Badge variant="outline" className="text-orange-600">
              Unsaved Changes
            </Badge>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Global Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-alerts">Enable Alerts</Label>
              <p className="text-sm text-muted-foreground">Allow reasoning models to generate alerts</p>
            </div>
            <Switch 
              id="enable-alerts"
              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-white"
              checked={config.globalSettings.enableAlerts}
              onCheckedChange={(checked) => {
                config.globalSettings.enableAlerts = checked;
                setConfig({...config});
                setHasChanges(true);
              }}
            />
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max-alerts">Max Alerts per System</Label>
              <Input
                id="max-alerts"
                type="number"
                value={config.globalSettings.maxAlertsPerSystem}
                onChange={(e) => {
                  config.globalSettings.maxAlertsPerSystem = parseInt(e.target.value) || 50;
                  setConfig({...config});
                  setHasChanges(true);
                }}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="retention-days">Alert Retention (Days)</Label>
              <Input
                id="retention-days"
                type="number"
                value={config.globalSettings.alertRetentionDays}
                onChange={(e) => {
                  config.globalSettings.alertRetentionDays = parseInt(e.target.value) || 30;
                  setConfig({...config});
                  setHasChanges(true);
                }}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reasoning Models */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2" />
            Reasoning Models
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure AI models for system analysis and alert generation
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {sortedModels.map((model) => (
              <Card key={model.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="mt-1">
                        {getModelIcon(model.id)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium">{model.name}</h3>
                          <Badge variant={model.enabled ? "default" : "secondary"}>
                            Priority {model.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {model.description}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`interval-${model.id}`} className="text-xs">
                              Check Interval (minutes)
                            </Label>
                            <Input
                              id={`interval-${model.id}`}
                              type="number"
                              value={formatInterval(model.interval)}
                              onChange={(e) => handleIntervalChange(model.id, parseInt(e.target.value) || 10)}
                              disabled={!model.enabled}
                              className="mt-1 h-8"
                              min="1"
                              max="1440"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor={`priority-${model.id}`} className="text-xs">
                              Priority (1-10)
                            </Label>
                            <Input
                              id={`priority-${model.id}`}
                              type="number"
                              value={model.priority}
                              onChange={(e) => handlePriorityChange(model.id, parseInt(e.target.value) || 5)}
                              disabled={!model.enabled}
                              className="mt-1 h-8"
                              min="1"
                              max="10"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <Label className="text-xs text-muted-foreground">API Endpoint</Label>
                          <p className="text-xs font-mono bg-muted px-2 py-1 rounded mt-1">
                            {model.apiUrl}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-white"
                        checked={model.enabled}
                        onCheckedChange={() => handleModelToggle(model.id)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status Information */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Changes to reasoning models will take effect after the next analysis cycle. 
          Disabled models will stop generating new alerts but existing alerts will remain.
        </AlertDescription>
      </Alert>
    </div>
  );
}

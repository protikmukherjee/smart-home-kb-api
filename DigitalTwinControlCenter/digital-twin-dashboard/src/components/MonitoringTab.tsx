"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SystemDefinition } from "@/config/systemConfig";
import { getEnabledModels, type ReasoningModelConfig, setReasoningConfig } from "@/config/reasoningConfig";
import { getSystemFirebaseConfig } from "@/config/firebaseUrlConfig";
import FirebaseService from "@/lib/firebaseService";
import RealAnalyticsService from "@/lib/realAnalyticsService";
import RealReasoningService, { type ReasoningResult } from "@/lib/realReasoningService";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Brain,
  Bell,
  BellOff,
  Flame,
  Zap,
  Activity,
  Wrench,
  ShieldAlert,
  Package,
  ExternalLink,
} from "lucide-react";
import {
  runFaultCheckAll,
  fetchReplacementSuggestions,
  type FaultCheckResult,
  type Fault,
  type ReplacementSuggestion,
} from "@/lib/faultEngine";

interface MonitoringTabProps {
  systems: SystemDefinition[];
  mode: "real" | "simulated";
  onRefreshSystem?: (systemName: string) => void;
}

interface AlertItem {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  timestamp: number;
  systemName?: string;
  componentName?: string;
  sourceSystemId?: string;
  systemId?: string;
  componentType?: string;
  acknowledged: boolean;
  source: string;
  faultActive?: boolean;
}

export function MonitoringTab({ systems, mode, onRefreshSystem }: MonitoringTabProps) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enabledModels, setEnabledModels] = useState<ReasoningModelConfig[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<number>(Date.now());
  const [reasoningResults, setReasoningResults] = useState<ReasoningResult[]>([]);
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [isReasoningConfigured, setIsReasoningConfigured] = useState(true);
  const previousFaultStatesRef = useRef<Record<string, boolean>>({});

  // ── Fault Engine state ──
  const [faultResults, setFaultResults] = useState<FaultCheckResult[]>([]);
  const [isFaultChecking, setIsFaultChecking] = useState(false);
  const [lastFaultCheck, setLastFaultCheck] = useState<number>(0);
  const [kbSuggestions, setKbSuggestions] = useState<Record<string, ReplacementSuggestion[]>>({});
  const [loadingKbFor, setLoadingKbFor] = useState<string | null>(null);

  const systemMap = useMemo(() => {
    return new Map(systems.map((system) => [system.name, system]));
  }, [systems]);

  useEffect(() => {
    const loadMonitoringData = async () => {
      try {
        setIsLoading(true);

        let configured = false;
        const setupResponse = await fetch(`${process.env.NEXT_PUBLIC_DEV_API_URL ?? "http://localhost:4001"}/api/runtime/setup`);
        if (setupResponse.ok) {
          const configData = await setupResponse.json();
          if (configData.reasoning?.models && Array.isArray(configData.reasoning.models) && configData.reasoning.models.length > 0) {
            setReasoningConfig(configData.reasoning.models);
            setIsReasoningConfigured(true);
            configured = true;
          } else {
            setIsReasoningConfigured(false);
          }
        }

        if (configured) {
          RealReasoningService.initialize();
        } else {
          RealReasoningService.stop();
        }

        const models = getEnabledModels();
        setEnabledModels(models);

        const results = RealReasoningService.getAllResults();
        setReasoningResults(results);

        const analytics = await RealAnalyticsService.getCurrentAnalytics();
        const generatedAlerts = await generateAlertsFromAnalytics(analytics);

        setAlerts((prev) => {
          // Keep all previous alerts when generating new analytics alerts
          const preservedAlerts = prev;

          return [...generatedAlerts, ...preservedAlerts]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 100);
        });

        const lastAnalysisTime = RealReasoningService.getLastAnalysisTime();
        setLastAnalysis(lastAnalysisTime || Date.now());
      } catch (error) {
        console.error("Error loading monitoring data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMonitoringData();
  }, []);

  useEffect(() => {
    if (mode !== "real" || systems.length === 0) {
      return;
    }

    let isCancelled = false;
    let unsubscribeNotifications: (() => void) | undefined;

    const pollFaults = async () => {
      for (const system of systems) {
        const config = getSystemFirebaseConfig(system.name);
        if (!config?.faults) {
          continue;
        }

        for (const [componentName, faultConfig] of Object.entries(config.faults)) {
          if (!faultConfig?.faultUrl?.trim()) {
            continue;
          }

          const rawValue = await FirebaseService.getRawValue(faultConfig.faultUrl);
          const isFault = rawValue === true || rawValue === 1 || rawValue === "true";
          const key = `${system.name}::${componentName}`;
          const previous = previousFaultStatesRef.current[key];

          if (previous === undefined) {
            previousFaultStatesRef.current[key] = isFault;
            continue;
          }

          if (previous === isFault) {
            continue;
          }

          previousFaultStatesRef.current[key] = isFault;

          if (!isCancelled) {
            const componentType = system.components.find((component) => component.name === componentName)?.type;
            const nextAlert: AlertItem = {
              id: `fault-${system.name}-${componentName}-${Date.now()}`,
              type: isFault ? "critical" : "info",
              title: isFault ? "Component Fault Detected" : "Component Fault Resolved",
              description: isFault
                ? `${componentName} in ${system.displayName} changed from healthy to faulty.`
                : `${componentName} in ${system.displayName} changed from faulty to healthy.`,
              timestamp: Date.now(),
              systemName: system.name,
              componentName,
              sourceSystemId: system.sourceSystemId,
              systemId: system.id,
              componentType,
              acknowledged: false,
              source: "Fault Monitor",
              faultActive: isFault
            };

            setAlerts((prev) => [nextAlert, ...prev].slice(0, 100));
          }
        }
      }
    };

    pollFaults();

    // Subscribes purely to the RTDB "/notifications" global hook.
    // The upstream FirebaseInitializer should handle injecting the config.

    unsubscribeNotifications = FirebaseService.subscribeToNotifications((notifications) => {
      console.log("🔥 INCOMING FIREBASE NOTIFICATIONS:", notifications);
      if (isCancelled) return;

      setAlerts((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newAlerts: AlertItem[] = [];
        const now = Date.now();

        for (const [key, notif] of Object.entries(notifications || {})) {
          if (!notif) continue;

          // Generate an ID based on firebase key to prevent duplicates
          const alertId = `rt-notif-${key}`;

          if (!existingIds.has(alertId)) {
            const isFault = (notif as any).type === "critical" || (notif as any).isFault === true;
            newAlerts.push({
              id: alertId,
              type: (notif as any).type || "info",
              title: (notif as any).title || "System Notification",
              description: (notif as any).description || "",
              timestamp: (notif as any).timestamp || now,
              systemName: (notif as any).systemName,
              componentName: (notif as any).componentName,
              sourceSystemId: (notif as any).sourceSystemId,
              systemId: (notif as any).systemId || systemMap.get((notif as any).systemName)?.id,
              componentType: (notif as any).componentType,
              acknowledged: false,
              source: (notif as any).source || "Firebase Runtime DB",
              faultActive: isFault
            });
            existingIds.add(alertId);
          }
        }

        if (newAlerts.length === 0) return prev;

        return [...newAlerts, ...prev].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
      });
    });

    return () => {
      isCancelled = true;
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
      }
    };
  }, [systems, mode]);

  const generateAlertsFromAnalytics = async (analytics: any): Promise<AlertItem[]> => {
    const generated: AlertItem[] = [];
    const now = Date.now();

    if (analytics.totalPowerUsage > 500) {
      generated.push({
        id: `power-high-${now}`,
        type: "warning",
        title: "High Power Usage Detected",
        description: `Total power usage is ${analytics.totalPowerUsage}W, which exceeds the recommended threshold of 500W.`,
        timestamp: now,
        acknowledged: false,
        source: "Power Anomaly Detector"
      });
    }

    if (analytics.totalPowerUsage < 200) {
      generated.push({
        id: `power-low-${now}`,
        type: "warning",
        title: "Low Power Usage Detected",
        description: `Total power usage is ${analytics.totalPowerUsage}W, which is below the recommended threshold of 200W.`,
        timestamp: now,
        acknowledged: false,
        source: "Power Anomaly Detector"
      });
    }

    if (analytics.activeSystems === analytics.totalSystems) {
      generated.push({
        id: `all-systems-online-${now}`,
        type: "info",
        title: "All Systems Online",
        description: `All ${analytics.totalSystems} systems are currently operational.`,
        timestamp: now,
        acknowledged: false,
        source: "System Health Monitor"
      });
    }

    return generated.sort((a, b) => b.timestamp - a.timestamp);
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === alertId ? { ...alert, acknowledged: true } : alert))
    );
  };

  // ── Fault Engine: run checks across all systems ──
  const runFaultEngine = async () => {
    if (isFaultChecking) return;
    setIsFaultChecking(true);
    try {
      const systemNames = systems.map((s) => s.name);
      const results = await runFaultCheckAll(systemNames);
      setFaultResults(results);
      setLastFaultCheck(Date.now());

      // Convert detected faults into alerts
      const faultAlerts: AlertItem[] = [];
      for (const result of results) {
        for (const fault of result.faults) {
          const system = systems.find((s) => s.name === fault.systemName);
          faultAlerts.push({
            id: `engine-${fault.systemName}-${fault.componentName}-${fault.code}-${fault.timestamp}`,
            type: fault.severity === "CRIT" ? "critical" : fault.severity === "WARN" ? "warning" : "info",
            title: `${fault.code.replace(/_/g, " ")}: ${fault.componentName}`,
            description: fault.detail,
            timestamp: fault.timestamp,
            systemName: fault.systemName,
            componentName: fault.componentName,
            sourceSystemId: system?.sourceSystemId,
            systemId: system?.id,
            componentType: system?.components.find((c) => c.name === fault.componentName)?.type,
            acknowledged: false,
            source: "Fault Engine",
            faultActive: fault.severity === "CRIT" || fault.severity === "WARN",
          });
        }
      }

      if (faultAlerts.length > 0) {
        setAlerts((prev) => {
          // Deduplicate by keeping newest engine alerts and removing old engine ones
          const nonEngine = prev.filter((a) => !a.id.startsWith("engine-"));
          return [...faultAlerts, ...nonEngine].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
        });
      }
    } catch (err) {
      console.error("Fault engine error:", err);
    } finally {
      setIsFaultChecking(false);
    }
  };

  // ── KB Replacement Suggestions: fetch for a specific component ──
  const fetchKbSuggestions = async (componentName: string, componentType?: string) => {
    const key = componentName;
    if (kbSuggestions[key]) return; // already fetched
    setLoadingKbFor(key);
    try {
      const suggestions = await fetchReplacementSuggestions(componentName, componentType);
      setKbSuggestions((prev) => ({ ...prev, [key]: suggestions }));
    } catch {
      setKbSuggestions((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setLoadingKbFor(null);
    }
  };

  const openFaultReplacementPage = (alert: AlertItem) => {
    const targetId = alert.systemId || alert.sourceSystemId;
    if (!alert.systemName || !alert.componentName || !targetId) {
      console.warn("Missing parameters for replacement page", alert);
      return;
    }

    const params = new URLSearchParams({
      systemName: alert.systemName,
      componentName: alert.componentName,
      sourceSystemId: targetId,
      componentType: alert.componentType ?? "",
      alertId: alert.id
    });

    router.push(`/fault-replacement?${params.toString()}`);
  };

  const getAlertIcon = (type: AlertItem["type"]) => {
    switch (type) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getAlertBadgeVariant = (type: AlertItem["type"]) => {
    switch (type) {
      case "critical":
        return "destructive" as const;
      case "warning":
        return "secondary" as const;
      case "info":
        return "default" as const;
      default:
        return "outline" as const;
    }
  };

  const criticalAlerts = alerts.filter((alert) => alert.type === "critical" && !alert.acknowledged);
  const warningAlerts = alerts.filter((alert) => alert.type === "warning" && !alert.acknowledged);
  const infoAlerts = alerts.filter((alert) => alert.type === "info" && !alert.acknowledged);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="mr-3 h-8 w-8 animate-spin" />
        <span className="text-lg">Loading monitoring data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Monitoring</h2>
          <p className="text-muted-foreground">Real-time alerts and system health monitoring</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-sm">
            Last analysis: {new Date(lastAnalysis).toLocaleTimeString()}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={isRunningAnalysis}
            onClick={async () => {
              setIsRunningAnalysis(true);
              try {
                await RealReasoningService.runAllAnalysis();
                const results = RealReasoningService.getAllResults();
                setReasoningResults(results);
                const lastAnalysisTime = RealReasoningService.getLastAnalysisTime();
                setLastAnalysis(lastAnalysisTime || Date.now());
              } catch (error) {
                console.error("Error running analysis:", error);
              } finally {
                setIsRunningAnalysis(false);
              }
            }}
          >
            {isRunningAnalysis ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Brain className="mr-2 h-4 w-4" />
            )}
            {isRunningAnalysis ? "Running..." : "Run Analysis"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              systems.forEach((system) => onRefreshSystem?.(system.name));
              window.location.reload();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {!isReasoningConfigured && (
        <Alert variant="destructive" className="border-red-500 bg-red-50 text-red-900 border-2">
          <AlertTriangle className="h-4 w-4" />
          <h4 className="font-semibold mb-1">Reasoning models are not configured</h4>
          <AlertDescription>
            You must configure reasoning models before they can be used for system monitoring and automated analysis.
            <div className="mt-2">
              <Link href="/runtime-setup" className="font-semibold underline hover:text-red-700">Go to Runtime Setup</Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-600">{criticalAlerts.length}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Warning Alerts</p>
                <p className="text-2xl font-bold text-yellow-600">{warningAlerts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Info Alerts</p>
                <p className="text-2xl font-bold text-blue-600">{infoAlerts.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Models</p>
                <p className="text-2xl font-bold">{enabledModels.length}</p>
              </div>
              <Brain className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="mr-2 h-5 w-5" />
            Reasoning Analysis Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reasoningResults.map((result) => (
              <Card key={result.modelId} className="border">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-medium">{result.modelName}</h4>
                    <Badge variant={result.success ? "default" : "destructive"} className="text-xs">
                      {result.success ? "Success" : "Failed"}
                    </Badge>
                  </div>
                  {!result.success ? (
                    <div className="text-sm text-red-500">Error: {result.error}</div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Model ran successfully.</div>
                  )}
                  <div className="mt-3 flex items-center text-xs text-muted-foreground">
                    <Clock className="mr-1 h-3 w-3" />
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            ))}
            {reasoningResults.length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground">
                <Brain className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>No reasoning results available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Fault Engine Card ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <ShieldAlert className="mr-2 h-5 w-5" />
              Fault Detection Engine
            </CardTitle>
            <div className="flex items-center gap-2">
              {lastFaultCheck > 0 && (
                <Badge variant="outline" className="text-xs">
                  Last check: {new Date(lastFaultCheck).toLocaleTimeString()}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={isFaultChecking}
                onClick={runFaultEngine}
              >
                {isFaultChecking ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                )}
                {isFaultChecking ? "Checking..." : "Run Fault Check"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {faultResults.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <ShieldAlert className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p>No fault checks run yet</p>
              <p className="text-sm mt-1">Click &quot;Run Fault Check&quot; to scan all systems for anomalies</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {faultResults.map((r) => (
                  <div
                    key={r.systemName}
                    className={`rounded-xl border p-3 text-center text-sm ${
                      r.healthy
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <p className="font-semibold text-xs truncate">
                      {r.systemName.replace("Smart", "").replace("System", "")}
                    </p>
                    {r.healthy ? (
                      <p className="text-emerald-700 mt-0.5 flex items-center justify-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> Healthy
                      </p>
                    ) : (
                      <p className="text-red-700 mt-0.5 flex items-center justify-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> {r.faults.length} fault{r.faults.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Detailed faults with KB suggestions */}
              {faultResults
                .filter((r) => !r.healthy)
                .map((r) => (
                  <div key={r.systemName} className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      {r.systemName}
                    </h4>
                    <div className="space-y-2">
                      {r.faults.map((fault, idx) => (
                        <div key={idx} className="rounded-lg border border-red-100 bg-white p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={fault.severity === "CRIT" ? "destructive" : "secondary"} className="text-[10px]">
                                  {fault.severity}
                                </Badge>
                                <span className="font-mono text-xs text-muted-foreground">{fault.code}</span>
                              </div>
                              <p className="text-sm">{fault.detail}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Component: <strong>{fault.componentName}</strong> · {fault.propertyName}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 text-xs"
                              disabled={loadingKbFor === fault.componentName}
                              onClick={() => fetchKbSuggestions(fault.componentName, undefined)}
                            >
                              {loadingKbFor === fault.componentName ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Package className="mr-1 h-3 w-3" />
                              )}
                              Find Replacement
                            </Button>
                          </div>

                          {/* KB Suggestions inline */}
                          {kbSuggestions[fault.componentName] && kbSuggestions[fault.componentName].length > 0 && (
                            <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/50 p-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 mb-1.5 flex items-center gap-1">
                                <Package className="h-3 w-3" /> KB Replacement Suggestions
                              </p>
                              <div className="space-y-1">
                                {kbSuggestions[fault.componentName].map((sug) => (
                                  <div
                                    key={sug.id}
                                    className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs border border-violet-100"
                                  >
                                    <div>
                                      <span className="font-medium">{sug.title}</span>
                                      <span className="text-muted-foreground ml-2">
                                        {sug.category}/{sug.subcategory}
                                      </span>
                                      {sug.price !== null && (
                                        <span className="ml-2 font-semibold text-violet-700">
                                          ${sug.price.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-muted-foreground">Score: {sug.score}</span>
                                      {sug.purchaseUrl && (
                                        <a
                                          href={sug.purchaseUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-violet-500 hover:text-violet-700"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="mr-2 h-5 w-5" />
            Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <BellOff className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>No alerts at this time</p>
                <p className="text-sm">All systems are operating normally</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <Alert
                  key={alert.id}
                  className={`${alert.acknowledged ? "opacity-50" : ""} ${alert.faultActive && alert.systemName && alert.componentName && (alert.systemId || alert.sourceSystemId)
                    ? "cursor-pointer"
                    : ""
                    }`}
                  onClick={() => {
                    if (alert.faultActive && alert.systemName && alert.componentName && (alert.systemId || alert.sourceSystemId)) {
                      openFaultReplacementPage(alert);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <div className="mb-1 flex items-center space-x-2">
                          <h4 className="font-medium">{alert.title}</h4>
                          <Badge variant={getAlertBadgeVariant(alert.type)} className="text-xs">
                            {alert.type}
                          </Badge>
                          {alert.systemName && (
                            <Badge variant="outline" className="text-xs">
                              {alert.systemName.replace("Smart", "").replace("System", "")}
                            </Badge>
                          )}
                        </div>
                        <AlertDescription className="text-sm">{alert.description}</AlertDescription>
                        <div className="mt-2 flex items-center space-x-4 text-xs text-muted-foreground">
                          <span className="flex items-center">
                            <Clock className="mr-1 h-3 w-3" />
                            {new Date(alert.timestamp).toLocaleString()}
                          </span>
                          <span className="flex items-center">
                            <Brain className="mr-1 h-3 w-3" />
                            {alert.source}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {alert.faultActive && alert.systemName && alert.componentName && (alert.systemId || alert.sourceSystemId) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            openFaultReplacementPage(alert);
                          }}
                        >
                          <Wrench className="mr-1 h-3.5 w-3.5" />
                          Replace Component
                        </Button>
                      ) : null}
                      {!alert.acknowledged ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            acknowledgeAlert(alert.id);
                          }}
                          className="text-xs"
                        >
                          Acknowledge
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Alert>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

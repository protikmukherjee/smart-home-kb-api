import { useState, useEffect, useCallback } from 'react';
import ReasoningService, { Alert } from '@/lib/reasoningService';

export function useReasoningService() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to alerts on mount
  useEffect(() => {
    const unsubscribe = ReasoningService.subscribeToAlerts((newAlerts) => {
      setAlerts(newAlerts);
      setIsLoading(false);
    });

    // Initialize the service
    ReasoningService.initialize();

    return unsubscribe;
  }, []);

  // Acknowledge an alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    ReasoningService.acknowledgeAlert(alertId);
  }, []);

  // Resolve an alert
  const resolveAlert = useCallback((alertId: string) => {
    ReasoningService.resolveAlert(alertId);
  }, []);

  // Clear all alerts
  const clearAllAlerts = useCallback(() => {
    ReasoningService.clearAllAlerts();
  }, []);

  // Add a manual alert
  const addAlert = useCallback((alertData: Partial<Alert>) => {
    ReasoningService.addAlert(alertData);
  }, []);

  // Get service status
  const getStatus = useCallback(() => {
    return ReasoningService.getStatus();
  }, []);

  // Get filtered alerts
  const getUnacknowledgedAlerts = useCallback(() => {
    return alerts.filter(alert => !alert.acknowledged);
  }, [alerts]);

  const getAlertsByLevel = useCallback((level: Alert['level']) => {
    return alerts.filter(alert => alert.level === level);
  }, [alerts]);

  const getAlertsBySystem = useCallback((systemName: string) => {
    return alerts.filter(alert => alert.systemName === systemName);
  }, [alerts]);

  return {
    alerts,
    isLoading,
    acknowledgeAlert,
    resolveAlert,
    clearAllAlerts,
    addAlert,
    getStatus,
    getUnacknowledgedAlerts,
    getAlertsByLevel,
    getAlertsBySystem,
    // Computed values
    unacknowledgedCount: alerts.filter(a => !a.acknowledged).length,
    criticalCount: alerts.filter(a => a.level === 'critical' && !a.resolved).length,
    errorCount: alerts.filter(a => a.level === 'error' && !a.resolved).length,
    warningCount: alerts.filter(a => a.level === 'warning' && !a.resolved).length,
  };
}

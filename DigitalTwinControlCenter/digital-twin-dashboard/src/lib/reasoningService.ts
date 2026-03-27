// Reasoning service that analyzes system data and generates alerts
export interface AlertLevel {
  level: 'info' | 'warning' | 'error' | 'critical';
  priority: number;
}

export interface Alert {
  id: string;
  timestamp: number;
  level: AlertLevel['level'];
  priority: number;
  title: string;
  message: string;
  systemName: string;
  componentName?: string;
  data?: any;
  acknowledged: boolean;
  resolved: boolean;
}

export interface ReasoningConfig {
  apiUrl: string;
  interval: number; // in milliseconds
  enabled: boolean;
}

export interface SystemAnalysisData {
  systemName: string;
  timestamp: number;
  components: Record<string, any>;
  systemState: any;
  powerUsage?: number;
  networkStatus?: boolean;
  temperature?: number;
  errors?: string[];
}

// Global alerts store
let globalAlerts: Alert[] = [];
const alertSubscribers = new Set<(alerts: Alert[]) => void>();

// Notify all subscribers of alert changes
function notifyAlertSubscribers() {
  alertSubscribers.forEach(callback => callback([...globalAlerts]));
}

export class ReasoningService {
  private static config: ReasoningConfig = {
    apiUrl: process.env.NEXT_PUBLIC_REASONING_API_URL || 'http://localhost:8081/api/reasoning',
    interval: 10 * 60 * 1000, // 10 minutes
    enabled: true
  };
  
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  // Initialize the reasoning service
  static initialize(config?: Partial<ReasoningConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    if (this.config.enabled && !this.isRunning) {
      this.start();
    }
  }

  // Start the reasoning service
  static start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Reasoning service started');
    
    // Run immediately
    this.analyzeAllSystems();
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.analyzeAllSystems();
    }, this.config.interval);
  }

  // Stop the reasoning service
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Reasoning service stopped');
  }

  // Analyze all systems and generate alerts
  static async analyzeAllSystems() {
    try {
      // This would typically get data from your system state store
      // For now, we'll simulate some analysis
      const systemsData = await this.collectSystemsData();
      
      if (systemsData.length === 0) {
        console.log('No systems data available for analysis');
        return;
      }

      // Send data to reasoning API
      const analysis = await this.callReasoningAPI(systemsData);
      
      // Process the analysis results and generate alerts
      this.processAnalysisResults(analysis);
      
      console.log(`Analyzed ${systemsData.length} systems, generated ${analysis.alerts?.length || 0} alerts`);
    } catch (error) {
      console.error('Error in reasoning analysis:', error);
      
      // Generate an alert about the reasoning service failure
      this.addAlert({
        level: 'error',
        title: 'Reasoning Service Error',
        message: `Failed to analyze systems: ${error instanceof Error ? error.message : 'Unknown error'}`,
        systemName: 'ReasoningService',
        data: { error: error instanceof Error ? error.message : error }
      });
    }
  }

  // Collect data from all systems
  private static async collectSystemsData(): Promise<SystemAnalysisData[]> {
    // This would integrate with your actual system state
    // For now, return mock data
    return [
      {
        systemName: 'SmartGarageDoorSystem',
        timestamp: Date.now(),
        components: {
          'GarageDoor_Unit': { isOpen: false, isMoving: false },
          'UltraSonic_Sensor': { distance: 50, motion_detected: false },
          'Power_Component': { power_total: 150, battery_level: 85 }
        },
        systemState: { isOn: true },
        powerUsage: 150,
        networkStatus: true,
        temperature: 22
      },
      {
        systemName: 'SmartLightSystem',
        timestamp: Date.now(),
        components: {
          'LEDLight_Unit': { isOn: true, brightness: 80 },
          'Motion_Sensor': { motion_detected: true },
        },
        systemState: { isOn: true },
        powerUsage: 75,
        networkStatus: true
      }
    ];
  }

  // Call the reasoning API
  private static async callReasoningAPI(systemsData: SystemAnalysisData[]): Promise<any> {
    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: Date.now(),
          systems: systemsData,
          analysisType: 'comprehensive'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // If API is not available, generate local analysis
      console.warn('Reasoning API not available, using local analysis');
      return this.performLocalAnalysis(systemsData);
    }
  }

  // Perform local analysis when API is not available
  private static performLocalAnalysis(systemsData: SystemAnalysisData[]): any {
    const alerts: any[] = [];
    
    systemsData.forEach(system => {
      // Check power usage
      if (system.powerUsage && system.powerUsage > 200) {
        alerts.push({
          level: 'warning',
          title: 'High Power Usage',
          message: `${system.systemName} is consuming ${system.powerUsage}W, which is above normal levels`,
          systemName: system.systemName,
          data: { powerUsage: system.powerUsage, threshold: 200 }
        });
      }

      // Check network status
      if (system.networkStatus === false) {
        alerts.push({
          level: 'error',
          title: 'Network Disconnected',
          message: `${system.systemName} has lost network connectivity`,
          systemName: system.systemName,
          data: { networkStatus: system.networkStatus }
        });
      }

      // Check temperature
      if (system.temperature && (system.temperature > 35 || system.temperature < 5)) {
        alerts.push({
          level: system.temperature > 40 ? 'critical' : 'warning',
          title: 'Temperature Alert',
          message: `${system.systemName} temperature is ${system.temperature}°C`,
          systemName: system.systemName,
          data: { temperature: system.temperature }
        });
      }

      // Check component-specific issues
      Object.entries(system.components).forEach(([componentName, componentData]: [string, any]) => {
        if (componentData.battery_level && componentData.battery_level < 20) {
          alerts.push({
            level: componentData.battery_level < 10 ? 'critical' : 'warning',
            title: 'Low Battery',
            message: `${componentName} battery level is ${componentData.battery_level}%`,
            systemName: system.systemName,
            componentName,
            data: { batteryLevel: componentData.battery_level }
          });
        }
      });
    });

    return { alerts, analysis: 'local', timestamp: Date.now() };
  }

  // Process analysis results and generate alerts
  private static processAnalysisResults(analysis: any) {
    if (analysis.alerts && Array.isArray(analysis.alerts)) {
      analysis.alerts.forEach((alertData: any) => {
        this.addAlert(alertData);
      });
    }
  }

  // Add a new alert
  static addAlert(alertData: Partial<Alert>) {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level: alertData.level || 'info',
      priority: this.getPriorityForLevel(alertData.level || 'info'),
      title: alertData.title || 'System Alert',
      message: alertData.message || 'No message provided',
      systemName: alertData.systemName || 'Unknown',
      componentName: alertData.componentName,
      data: alertData.data,
      acknowledged: false,
      resolved: false,
      ...alertData
    };

    globalAlerts.unshift(alert); // Add to beginning
    
    // Keep only the last 100 alerts
    if (globalAlerts.length > 100) {
      globalAlerts = globalAlerts.slice(0, 100);
    }

    notifyAlertSubscribers();
  }

  // Get priority number for alert level
  private static getPriorityForLevel(level: AlertLevel['level']): number {
    switch (level) {
      case 'critical': return 4;
      case 'error': return 3;
      case 'warning': return 2;
      case 'info': return 1;
      default: return 1;
    }
  }

  // Get all alerts
  static getAlerts(): Alert[] {
    return [...globalAlerts];
  }

  // Get unacknowledged alerts
  static getUnacknowledgedAlerts(): Alert[] {
    return globalAlerts.filter(alert => !alert.acknowledged);
  }

  // Acknowledge an alert
  static acknowledgeAlert(alertId: string) {
    const alert = globalAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      notifyAlertSubscribers();
    }
  }

  // Resolve an alert
  static resolveAlert(alertId: string) {
    const alert = globalAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.acknowledged = true;
      notifyAlertSubscribers();
    }
  }

  // Subscribe to alert changes
  static subscribeToAlerts(callback: (alerts: Alert[]) => void): () => void {
    alertSubscribers.add(callback);
    
    // Send current alerts immediately
    callback([...globalAlerts]);
    
    return () => {
      alertSubscribers.delete(callback);
    };
  }

  // Clear all alerts
  static clearAllAlerts() {
    globalAlerts = [];
    notifyAlertSubscribers();
  }

  // Get service status
  static getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      alertCount: globalAlerts.length,
      unacknowledgedCount: globalAlerts.filter(a => !a.acknowledged).length
    };
  }
}

export default ReasoningService;

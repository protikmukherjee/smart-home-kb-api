import { getEnabledModels, type ReasoningModelConfig } from "@/config/reasoningConfig";
import RealAnalyticsService from "./realAnalyticsService";
import FirebaseService from "./firebaseService";

export interface ReasoningResult {
  modelId: string;
  modelName: string;
  timestamp: number;
  success: boolean;
  data?: any;
  error?: string;
}

export interface FireDetectionResult {
  probability: number;
  status: string;
}

export interface PowerAnalysisResult {
  idleSystemName: string;
  mostPowerUsedSystemName: string;
  leastPowerUsedSystemName: string;
}

export interface HealthCheckResult {
  status: string;
}

class RealReasoningService {
  private static results: Map<string, ReasoningResult> = new Map();
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  // Initialize and start the reasoning service
  static initialize() {
    if (!this.isRunning) {
      this.start();
    }
  }

  // Start the reasoning service
  static start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Real Reasoning Service started');
    
    // Run immediately
    this.runAllAnalysis();
    
    // Set up interval for every 10 minutes
    this.intervalId = setInterval(() => {
      this.runAllAnalysis();
    }, 10 * 60 * 1000);
  }

  // Stop the reasoning service
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Real Reasoning Service stopped');
  }

  // Run all enabled reasoning models
  static async runAllAnalysis() {
    const enabledModels = getEnabledModels();
    
    for (const model of enabledModels) {
      try {
        await this.runModelAnalysis(model);
      } catch (error) {
        console.error(`Error running analysis for model ${model.id}:`, error);
        this.results.set(model.id, {
          modelId: model.id,
          modelName: model.name,
          timestamp: Date.now(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Run analysis for a specific model
  static async runModelAnalysis(model: ReasoningModelConfig) {
    console.log(`Running analysis for model: ${model.name}`);
    
    try {
      let result: any;
      
      switch (model.id) {
        case 'early-fire-detection':
          result = await this.runFireDetection(model);
          break;
        case 'power-anomaly-detector':
          result = await this.runPowerAnalysis(model);
          break;
        case 'system-health-monitor':
          result = await this.runHealthCheck(model);
          break;
        default:
          throw new Error(`Unknown model type: ${model.id}`);
      }

      this.results.set(model.id, {
        modelId: model.id,
        modelName: model.name,
        timestamp: Date.now(),
        success: true,
        data: result
      });

      console.log(`Analysis completed for ${model.name}:`, result);
    } catch (error) {
      console.error(`Analysis failed for ${model.name}:`, error);
      this.results.set(model.id, {
        modelId: model.id,
        modelName: model.name,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Fire detection analysis
  static async runFireDetection(model: ReasoningModelConfig): Promise<FireDetectionResult> {
    console.log('🔥 Running fire detection - fetching real values from Firebase...');

    try {
      // Fetch real values from Firebase (all async calls)
      const [heatValue, smokeValue, humidityValue, eCO2Value] = await Promise.all([
        FirebaseService.getPropertyValue('SmartFireSystem', 'Heat_Sensor', 'temperature'),
        FirebaseService.getPropertyValue('SmartFireSystem', 'Smoke_Sensor', 'smoke_detected'),
        FirebaseService.getPropertyValue('SmartFireSystem', 'Humidity_Sensor', 'humidity'),
        FirebaseService.getPropertyValue('SmartFireSystem', 'eCO2_Sensor', 'eCO2')
      ]);

      // Convert smoke detection boolean to numeric value for API
      const smokeNumeric = smokeValue ? 100 : 0;

      // Use real values or fallback to defaults if Firebase values are null
      const fireData = {
        "Heat": heatValue ?? model.parameters?.Heat ?? 9,
        "Smoke": smokeNumeric,
        "Humidity": humidityValue ?? model.parameters?.Humidity ?? 10,
        "eCO2": eCO2Value ?? model.parameters?.eCO2 ?? 10000
      };

      console.log('🔥 Fire detection data from Firebase:', {
        heatFromFirebase: heatValue,
        smokeFromFirebase: smokeValue,
        humidityFromFirebase: humidityValue,
        eCO2FromFirebase: eCO2Value,
        finalData: fireData
      });

      const response = await fetch(model.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fireData),
      });

      console.log('🔥 Fire detection API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔥 Fire detection API error:', errorText);
        throw new Error(`Fire detection API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('🔥 Fire detection result:', result);

      return {
        probability: result.probability,
        status: result.status
      };
    } catch (error) {
      console.error('🔥 Error in fire detection analysis:', error);
      throw error;
    }
  }

  // Power analysis
  static async runPowerAnalysis(model: ReasoningModelConfig): Promise<PowerAnalysisResult> {
    // Get current analytics data to send power info of all systems
    const analytics = await RealAnalyticsService.getCurrentAnalytics();
    
    const powerData = analytics.systemPowerData.map((system: any) => ({
      systemName: system.systemName,
      powerUsage: system.powerUsage,
      isOn: system.isOn
    }));

    const response = await fetch(model.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ systems: powerData }),
    });

    if (!response.ok) {
      throw new Error(`Power analysis API error: ${response.status}`);
    }

    const result = await response.json();
    return {
      idleSystemName: result.idleSystemName,
      mostPowerUsedSystemName: result.mostPowerUsedSystemName,
      leastPowerUsedSystemName: result.leastPowerUsedSystemName
    };
  }

  // Health check analysis
  static async runHealthCheck(model: ReasoningModelConfig): Promise<HealthCheckResult> {
    const response = await fetch(model.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Health check API error: ${response.status}`);
    }

    const result = await response.json();
    return {
      status: result.status || 'ok'
    };
  }

  // Get all results
  static getAllResults(): ReasoningResult[] {
    return Array.from(this.results.values());
  }

  // Get result for a specific model
  static getResult(modelId: string): ReasoningResult | undefined {
    return this.results.get(modelId);
  }

  // Get fire detection result
  static getFireDetectionResult(): (ReasoningResult & { data: FireDetectionResult }) | undefined {
    const result = this.results.get('early-fire-detection');
    return result?.success ? result as (ReasoningResult & { data: FireDetectionResult }) : undefined;
  }

  // Get power analysis result
  static getPowerAnalysisResult(): (ReasoningResult & { data: PowerAnalysisResult }) | undefined {
    const result = this.results.get('power-anomaly-detector');
    return result?.success ? result as (ReasoningResult & { data: PowerAnalysisResult }) : undefined;
  }

  // Get health check result
  static getHealthCheckResult(): (ReasoningResult & { data: HealthCheckResult }) | undefined {
    const result = this.results.get('system-health-monitor');
    return result?.success ? result as (ReasoningResult & { data: HealthCheckResult }) : undefined;
  }

  // Check if service is running
  static isServiceRunning(): boolean {
    return this.isRunning;
  }

  // Get last analysis time
  static getLastAnalysisTime(): number | undefined {
    const results = Array.from(this.results.values());
    if (results.length === 0) return undefined;
    
    return Math.max(...results.map(r => r.timestamp));
  }
}

export default RealReasoningService;

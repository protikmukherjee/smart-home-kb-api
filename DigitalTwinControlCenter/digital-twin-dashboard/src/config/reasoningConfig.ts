// Configuration for reasoning models and alert generation
export interface ReasoningModelConfig {
  id: string;
  name: string;
  description: string;
  apiUrl: string;
  enabled: boolean;
  interval: number; // in milliseconds
  priority: number; // 1-10, higher = more important
  parameters?: Record<string, any>;
}

export interface ReasoningConfig {
  models: ReasoningModelConfig[];
  globalSettings: {
    enableAlerts: boolean;
    maxAlertsPerSystem: number;
    alertRetentionDays: number;
    defaultInterval: number;
  };
}

// Default reasoning model configurations
export let DEFAULT_REASONING_CONFIG: ReasoningConfig = {
  models: [
    {
      id: 'early-fire-detection',
      name: 'Early Fire Detection',
      description: 'Detects early signs of fire using environmental sensors',
      apiUrl: 'https://fire-prediction-api.onrender.com/predict',
      enabled: true,
      interval: 10 * 60 * 1000, // 10 minutes
      priority: 10,
      parameters: {
        Heat: 9,
        Smoke: 20,
        Humidity: 10,
        eCO2: 10000,
      }
    },
    {
      id: 'power-anomaly-detector',
      name: 'Power Usage Monitor',
      description: 'Monitors power usage and identifies system efficiency patterns',
      apiUrl: process.env.NEXT_PUBLIC_POWER_REASONING_API || 'http://localhost:8081/api/reasoning/power',
      enabled: true,
      interval: 10 * 60 * 1000, // 10 minutes
      priority: 8,
      parameters: {}
    },
    {
      id: 'system-health-monitor',
      name: 'System Health Monitor',
      description: 'Monitors overall system health and component status',
      apiUrl: process.env.NEXT_PUBLIC_HEALTH_REASONING_API || 'http://localhost:8081/api/reasoning/health',
      enabled: true,
      interval: 10 * 60 * 1000, // 10 minutes
      priority: 9,
      parameters: {}
    }
  ],
  globalSettings: {
    enableAlerts: true,
    maxAlertsPerSystem: 50,
    alertRetentionDays: 30,
    defaultInterval: 10 * 60 * 1000 // 10 minutes
  }
};

// Helper functions
export function getEnabledModels(): ReasoningModelConfig[] {
  return DEFAULT_REASONING_CONFIG.models.filter(model => model.enabled);
}

export function getModelById(id: string): ReasoningModelConfig | undefined {
  return DEFAULT_REASONING_CONFIG.models.find(model => model.id === id);
}

export function updateModelConfig(id: string, updates: Partial<ReasoningModelConfig>): boolean {
  const modelIndex = DEFAULT_REASONING_CONFIG.models.findIndex(model => model.id === id);
  if (modelIndex === -1) return false;

  DEFAULT_REASONING_CONFIG.models[modelIndex] = {
    ...DEFAULT_REASONING_CONFIG.models[modelIndex],
    ...updates
  };

  return true;
}

export function toggleModel(id: string): boolean {
  const model = getModelById(id);
  if (!model) return false;

  return updateModelConfig(id, { enabled: !model.enabled });
}

export function getModelsByPriority(): ReasoningModelConfig[] {
  return [...DEFAULT_REASONING_CONFIG.models].sort((a, b) => b.priority - a.priority);
}

export function getReasoningConfig(): ReasoningConfig {
  return DEFAULT_REASONING_CONFIG;
}

export function setReasoningConfig(apiModels: Array<{ id: string, name: string, enabled: boolean, apiUrl: string }>) {
  for (const apiModel of apiModels) {
    const existing = DEFAULT_REASONING_CONFIG.models.find(m => m.id === apiModel.id);
    if (existing) {
      existing.enabled = apiModel.enabled;
      existing.apiUrl = apiModel.apiUrl;
    }
  }
}

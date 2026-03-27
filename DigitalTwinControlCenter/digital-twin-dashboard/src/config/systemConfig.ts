// Import original system definitions
import { SYSTEM_DEFINITIONS as ORIGINAL_SYSTEMS, SystemDefinition as OriginalSystemDefinition } from '@/types/systems';

// System configuration - defines what cards/systems should be created
export interface ComponentDefinition {
  name: string;
  type: 'sensor' | 'actuator' | 'controller' | 'unit' | 'network' | 'power' | 'temperature';
  properties: Record<string, any>;
  actions?: string[];
  methods?: {
    getters: string[];
    setters: string[];
    actions: string[];
  };
}

export interface SystemDefinition {
  id?: string;
  sourceSystemId?: string;
  name: string;
  displayName: string;
  description: string;
  components: ComponentDefinition[];
  icon?: string;
  mainClass?: string;
  dependencies?: string[];
}

// Convert original system definitions to new format
function convertOriginalSystem(original: OriginalSystemDefinition): SystemDefinition {
  return {
    name: original.name,
    displayName: original.displayName,
    description: original.description,
    mainClass: original.mainClass,
    dependencies: original.dependencies,
    components: original.components.map(comp => ({
      name: comp.name,
      type: comp.type,
      properties: Object.fromEntries(
        Object.entries(comp.properties).map(([key, prop]) => [
          key,
          prop.type === 'boolean' ? false : prop.type === 'number' ? 0 : ''
        ])
      ),
      actions: comp.methods.actions,
      methods: comp.methods
    }))
  };
}

// Use original system definitions
export const SYSTEM_DEFINITIONS: SystemDefinition[] = ORIGINAL_SYSTEMS.map(convertOriginalSystem);

// Helper functions
export function getSystemByName(name: string): SystemDefinition | undefined {
  return SYSTEM_DEFINITIONS.find(system => system.name === name);
}

export function getComponentsByType(systemName: string, type: ComponentDefinition['type']): ComponentDefinition[] {
  const system = getSystemByName(systemName);
  return system ? system.components.filter(component => component.type === type) : [];
}

export function getAllSystemNames(): string[] {
  return SYSTEM_DEFINITIONS.map(system => system.name);
}

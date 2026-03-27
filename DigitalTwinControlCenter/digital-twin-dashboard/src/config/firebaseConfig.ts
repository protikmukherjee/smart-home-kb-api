// Firebase configuration for real system mode
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Default Firebase configuration
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "digital-twin-demo.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://digital-twin-demo-default-rtdb.firebaseio.com/",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "digital-twin-demo",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "digital-twin-demo.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
};

// System-specific Firebase configurations (if needed)
export const SYSTEM_FIREBASE_CONFIGS: Record<string, Partial<FirebaseConfig>> = {
  // Override specific configs per system if needed
  // 'SmartHub': {
  //   databaseURL: 'https://smarthub-specific-db.firebaseio.com/'
  // }
};

let runtimeFirebaseAccountOverride: Partial<FirebaseConfig> = {};

export function setRuntimeFirebaseAccountOverride(override: Partial<FirebaseConfig>) {
  runtimeFirebaseAccountOverride = override;
}

// Helper function to get Firebase config for a system
export function getFirebaseConfig(systemName?: string): FirebaseConfig {
  const baseConfig = {
    ...DEFAULT_FIREBASE_CONFIG,
    ...runtimeFirebaseAccountOverride
  };

  if (systemName && SYSTEM_FIREBASE_CONFIGS[systemName]) {
    return {
      ...baseConfig,
      ...SYSTEM_FIREBASE_CONFIGS[systemName]
    };
  }
  return baseConfig;
}

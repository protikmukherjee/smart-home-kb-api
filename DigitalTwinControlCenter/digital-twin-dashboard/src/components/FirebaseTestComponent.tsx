"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FirebaseService from '@/lib/firebaseService';
import { getFirebaseConfig } from '@/config/firebaseConfig';

export function FirebaseTestComponent() {
  const [isConnected, setIsConnected] = useState(false);
  const [systemState, setSystemState] = useState<any>(null);
  const [componentStates, setComponentStates] = useState<Record<string, any>>({});
  const [lastUpdate, setLastUpdate] = useState<string>('Never');

  useEffect(() => {
    // Initialize Firebase
    const initFirebase = async () => {
      try {
        const config = getFirebaseConfig();
        FirebaseService.initialize(config);
        setIsConnected(true);
        console.log('Firebase initialized for testing');

        // Subscribe to SmartGarageDoorSystem state
        const systemUnsubscribe = FirebaseService.subscribeToSystemState(
          'SmartGarageDoorSystem',
          (data) => {
            console.log('System state update received:', data);
            setSystemState(data);
            setLastUpdate(new Date().toLocaleTimeString());
          }
        );

        // Subscribe to GarageDoor_Unit component
        const componentUnsubscribe = FirebaseService.subscribeToComponentState(
          'SmartGarageDoorSystem',
          'GarageDoor_Unit',
          (data) => {
            console.log('Component state update received:', data);
            setComponentStates(prev => ({
              ...prev,
              'GarageDoor_Unit': data
            }));
            setLastUpdate(new Date().toLocaleTimeString());
          }
        );

        // Subscribe to UltraSonic_Sensor component
        const sensorUnsubscribe = FirebaseService.subscribeToComponentState(
          'SmartGarageDoorSystem',
          'UltraSonic_Sensor',
          (data) => {
            console.log('Sensor state update received:', data);
            setComponentStates(prev => ({
              ...prev,
              'UltraSonic_Sensor': data
            }));
            setLastUpdate(new Date().toLocaleTimeString());
          }
        );

        // Cleanup function
        return () => {
          systemUnsubscribe();
          componentUnsubscribe();
          sensorUnsubscribe();
        };
      } catch (error) {
        console.error('Error initializing Firebase test:', error);
      }
    };

    const cleanup = initFirebase();
    return () => {
      cleanup?.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  const testWrite = async () => {
    try {
      // Test writing to system state
      await FirebaseService.updateSystemState('SmartGarageDoorSystem', {
        isOn: true,
        mode: 'test',
        testTimestamp: Date.now()
      });

      // Test writing to component property
      await FirebaseService.setPropertyValue(
        'SmartGarageDoorSystem',
        'GarageDoor_Unit',
        'door_open',
        !componentStates['GarageDoor_Unit']?.door_open
      );

      console.log('Test write completed');
    } catch (error) {
      console.error('Error in test write:', error);
    }
  };

  const testSensorWrite = async () => {
    try {
      // Test writing to sensor data
      await FirebaseService.setPropertyValue(
        'SmartGarageDoorSystem',
        'UltraSonic_Sensor',
        'distance',
        Math.floor(Math.random() * 100)
      );

      await FirebaseService.setPropertyValue(
        'SmartGarageDoorSystem',
        'UltraSonic_Sensor',
        'motion_detected',
        Math.random() > 0.5
      );

      console.log('Sensor test write completed');
    } catch (error) {
      console.error('Error in sensor test write:', error);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Firebase Real-time Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Last Update: {lastUpdate}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={testWrite} disabled={!isConnected}>
              Test System & Door Toggle
            </Button>
            <Button onClick={testSensorWrite} disabled={!isConnected}>
              Test Sensor Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System State Display */}
      <Card>
        <CardHeader>
          <CardTitle>System State</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-muted p-2 rounded">
            {JSON.stringify(systemState, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Component States Display */}
      <Card>
        <CardHeader>
          <CardTitle>Component States</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(componentStates).map(([componentName, state]) => (
            <div key={componentName}>
              <h4 className="font-medium mb-2">{componentName}</h4>
              <pre className="text-sm bg-muted p-2 rounded">
                {JSON.stringify(state, null, 2)}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Test Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <p>1. Click the test buttons above to write data to Firebase</p>
            <p>2. Open Firebase Console and manually change values at these paths:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><code>/SmartHomeSystem/SmartGarageDoorSystem/system_state</code></li>
              <li><code>/SmartHomeSystem/SmartGarageDoorSystem/status_door</code></li>
              <li><code>/SmartHomeSystem/SmartGarageDoorSystem/sensor_distance</code></li>
              <li><code>/SmartHomeSystem/SmartGarageDoorSystem/motion_detected</code></li>
            </ul>
            <p>3. Watch the values update in real-time above</p>
            <p>4. Check the browser console for detailed logs</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

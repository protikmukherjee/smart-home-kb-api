import { useEffect, useState } from 'react';
import DataTrackingService from '@/lib/dataTrackingService';

// Hook to initialize and manage data tracking
export function useDataTracking() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeTracking = async () => {
      try {
        console.log('🚀 Initializing data tracking service...');

        // Initialize data tracking service
        DataTrackingService.initialize();

        // Start tracking all systems when the dashboard loads
        await DataTrackingService.startTrackingAllSystems();

        setIsInitialized(true);
        console.log('✅ Data tracking initialized for all systems');
      } catch (error) {
        console.error('❌ Error initializing data tracking:', error);
      }
    };

    initializeTracking();

    // Cleanup function to stop tracking when component unmounts
    return () => {
      DataTrackingService.stopTrackingAllSystems();
      console.log('🛑 Data tracking stopped for all systems');
    };
  }, []);

  return {
    isInitialized,
    startTracking: DataTrackingService.startTracking.bind(DataTrackingService),
    stopTracking: DataTrackingService.stopTracking.bind(DataTrackingService),
    getCurrentMetrics: DataTrackingService.getCurrentMetrics.bind(DataTrackingService),
    getPowerUsageHistory: DataTrackingService.getPowerUsageHistory.bind(DataTrackingService),
    getUptimePercentage: DataTrackingService.getUptimePercentage.bind(DataTrackingService),
    seedInitialData: DataTrackingService.seedInitialData.bind(DataTrackingService)
  };
}

export default useDataTracking;

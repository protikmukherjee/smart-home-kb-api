// Test script to verify the fire detection API works correctly
export async function testFireDetectionAPI() {
  const apiUrl = 'https://fire-prediction-api.onrender.com/predict';
  const testData = {
    Heat: 9,
    Smoke: 20,
    Humidity: 10,
    eCO2: 10000
  };

  try {
    console.log('Testing Fire Detection API...');
    console.log('URL:', apiUrl);
    console.log('Data:', testData);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('API Response:', result);

    // Validate the expected response structure
    if (typeof result.probability !== 'number') {
      throw new Error('Invalid response: probability is not a number');
    }

    if (typeof result.status !== 'string') {
      throw new Error('Invalid response: status is not a string');
    }

    console.log('✅ Fire Detection API test successful!');
    console.log(`Probability: ${result.probability}`);
    console.log(`Status: ${result.status}`);

    return result;
  } catch (error) {
    console.error('❌ Fire Detection API test failed:', error);
    throw error;
  }
}

// Test function that can be called from browser console
if (typeof window !== 'undefined') {
  (window as any).testFireAPI = testFireDetectionAPI;
}

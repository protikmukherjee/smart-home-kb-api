import pandas as pd
import os

# --- CONFIGURATION ---
TARGET_CSV = 'data-entry/iotkb_refined.csv'

# --- THE STANDARD LIBRARY (Enriched with SOSA Semantics) ---
STANDARD_PARTS = [
    # --- CONTROLLERS (Controllers don't observe/act directly, they facilitate) ---
    {'part_label': 'Arduino Uno R3', 'manufacturer': 'Arduino', 'mpn': 'A000066', 'category': 'controller', 'kind': 'arduino', 'vcc_min': 7, 'vcc_max': 12, 'logic_level': 5.0, 'iface': 'UART|I2C|SPI|ADC|GPIO', 'clock_mhz': 16, 'notes': 'The standard starter board'},
    {'part_label': 'Arduino Nano', 'manufacturer': 'Arduino', 'mpn': 'A000005', 'category': 'controller', 'kind': 'arduino', 'vcc_min': 7, 'vcc_max': 12, 'logic_level': 5.0, 'iface': 'UART|I2C|SPI|ADC|GPIO', 'notes': 'Breadboard friendly'},
    {'part_label': 'Arduino Mega 2560', 'manufacturer': 'Arduino', 'mpn': 'A000067', 'category': 'controller', 'kind': 'arduino', 'vcc_min': 7, 'vcc_max': 12, 'logic_level': 5.0, 'iface': 'UART|I2C|SPI|ADC|GPIO', 'notes': 'Many GPIOs'},
    {'part_label': 'ESP32 DevKitC', 'manufacturer': 'Espressif', 'mpn': 'ESP32-DevKitC', 'category': 'controller', 'kind': 'esp32', 'vcc_min': 4.5, 'vcc_max': 9, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|I2S|ADC|DAC|GPIO', 'notes': 'WiFi + BT LE'},
    {'part_label': 'ESP8266 NodeMCU', 'manufacturer': 'Generic', 'mpn': 'NodeMCU v2', 'category': 'controller', 'kind': 'esp8266', 'vcc_min': 4.5, 'vcc_max': 9, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|ADC|GPIO', 'notes': 'Cheap WiFi'},
    {'part_label': 'Raspberry Pi 4 Model B', 'manufacturer': 'Raspberry Pi', 'mpn': 'RPI4-MODBP', 'category': 'controller', 'kind': 'sbc', 'vcc_min': 5.0, 'vcc_max': 5.25, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|GPIO|HDMI|USB', 'notes': 'Linux SBC'},
    {'part_label': 'Raspberry Pi Pico', 'manufacturer': 'Raspberry Pi', 'mpn': 'SC0915', 'category': 'controller', 'kind': 'microcontroller', 'vcc_min': 1.8, 'vcc_max': 5.5, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|ADC|GPIO', 'notes': 'RP2040 Dual Core M0+'},
    {'part_label': 'Raspberry Pi Pico W', 'manufacturer': 'Raspberry Pi', 'mpn': 'SC0918', 'category': 'controller', 'kind': 'microcontroller', 'vcc_min': 1.8, 'vcc_max': 5.5, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|ADC|GPIO', 'notes': 'RP2040 with WiFi'},
    {'part_label': 'Teensy 4.0', 'manufacturer': 'PJRC', 'mpn': 'TEENSY40', 'category': 'controller', 'kind': 'microcontroller', 'vcc_min': 3.6, 'vcc_max': 5.5, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|CAN|I2S', 'clock_mhz': 600, 'notes': 'Fastest microcontroller'},
    {'part_label': 'STM32 Blue Pill', 'manufacturer': 'Generic', 'mpn': 'STM32F103C8T6', 'category': 'controller', 'kind': 'microcontroller', 'vcc_min': 3.3, 'vcc_max': 5.0, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|CAN|ADC', 'notes': 'Cheap ARM Cortex-M3'},
    {'part_label': 'Seeeduino XIAO', 'manufacturer': 'Seeed Studio', 'mpn': '102010328', 'category': 'controller', 'kind': 'microcontroller', 'vcc_min': 3.3, 'vcc_max': 5.0, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|ADC|DAC', 'notes': 'Tiny SAMD21'},
    
    # --- SENSORS (Environmental) ---
    {'part_label': 'DHT11 Temp/Humidity', 'manufacturer': 'Generic', 'mpn': 'DHT11', 'category': 'sensor', 'kind': 'temp_humidity', 'observed_property': 'temperature|humidity', 'feature_of_interest': 'room_air', 'vcc_min': 3.5, 'vcc_max': 5.5, 'iface': 'Digital', 'accuracy_pct': 5, 'range_min': 0, 'range_max': 50, 'units': 'degC'},
    {'part_label': 'DHT22 (AM2302)', 'manufacturer': 'Generic', 'mpn': 'DHT22', 'category': 'sensor', 'kind': 'temp_humidity', 'observed_property': 'temperature|humidity', 'feature_of_interest': 'room_air', 'vcc_min': 3.3, 'vcc_max': 6.0, 'iface': 'Digital', 'accuracy_pct': 2, 'range_min': -40, 'range_max': 80, 'units': 'degC'},
    {'part_label': 'BME280 Breakout', 'manufacturer': 'Bosch/Adafruit', 'mpn': 'BME280', 'category': 'sensor', 'kind': 'environment', 'observed_property': 'temperature|humidity|pressure', 'feature_of_interest': 'room_air', 'vcc_min': 1.8, 'vcc_max': 3.6, 'iface': 'I2C|SPI', 'i2c_addr_default': '0x77', 'notes': 'High precision'},
    {'part_label': 'BMP180 Barometer', 'manufacturer': 'Bosch', 'mpn': 'BMP180', 'category': 'sensor', 'kind': 'pressure', 'observed_property': 'pressure|temperature', 'feature_of_interest': 'room_air', 'vcc_min': 1.8, 'vcc_max': 3.6, 'iface': 'I2C', 'i2c_addr_default': '0x77'},
    {'part_label': 'DS18B20 Temp Probe', 'manufacturer': 'Dallas', 'mpn': 'DS18B20', 'category': 'sensor', 'kind': 'temperature', 'observed_property': 'temperature', 'feature_of_interest': 'liquid|object', 'vcc_min': 3.0, 'vcc_max': 5.5, 'iface': 'OneWire', 'range_min': -55, 'range_max': 125, 'units': 'degC', 'notes': 'Waterproof available'},
    {'part_label': 'TMP36 Analog Temp', 'manufacturer': 'Analog Devices', 'mpn': 'TMP36', 'category': 'sensor', 'kind': 'temperature', 'observed_property': 'temperature', 'feature_of_interest': 'pcb|device', 'vcc_min': 2.7, 'vcc_max': 5.5, 'iface': 'ADC', 'notes': 'Simple analog output'},
    {'part_label': 'CCS811 Air Quality', 'manufacturer': 'AMS', 'mpn': 'CCS811', 'category': 'sensor', 'kind': 'gas', 'observed_property': 'eCO2|TVOC', 'feature_of_interest': 'room_air', 'vcc_min': 1.8, 'vcc_max': 3.3, 'iface': 'I2C', 'i2c_addr_default': '0x5A'},
    {'part_label': 'MQ-2 Gas Sensor', 'manufacturer': 'Generic', 'mpn': 'MQ-2', 'category': 'sensor', 'kind': 'gas', 'observed_property': 'smoke|lpg|propane', 'feature_of_interest': 'room_air', 'vcc_min': 5.0, 'vcc_max': 5.0, 'iface': 'ADC|Digital', 'notes': 'Heater needs warmup'},
    
    # --- SENSORS (Motion/Distance) ---
    {'part_label': 'HC-SR04 Ultrasonic', 'manufacturer': 'Generic', 'mpn': 'HC-SR04', 'category': 'sensor', 'kind': 'distance', 'observed_property': 'distance', 'feature_of_interest': 'obstacle_proximity', 'vcc_min': 4.5, 'vcc_max': 5.5, 'logic_level': 5.0, 'iface': 'GPIO_TRIGGER_ECHO', 'range_min': 2, 'range_max': 400, 'units': 'cm'},
    {'part_label': 'HC-SR501 PIR', 'manufacturer': 'Generic', 'mpn': 'HC-SR501', 'category': 'sensor', 'kind': 'motion', 'observed_property': 'motion', 'feature_of_interest': 'human_presence', 'vcc_min': 4.5, 'vcc_max': 20, 'logic_level': 3.3, 'iface': 'GPIO', 'notes': 'Infrared motion'},
    {'part_label': 'VL53L0X ToF', 'manufacturer': 'STMicro', 'mpn': 'VL53L0X', 'category': 'sensor', 'kind': 'distance', 'observed_property': 'distance', 'feature_of_interest': 'obstacle_proximity', 'vcc_min': 2.6, 'vcc_max': 3.5, 'iface': 'I2C', 'i2c_addr_default': '0x29', 'notes': 'Laser Time-of-Flight'},
    {'part_label': 'MPU-6050 IMU', 'manufacturer': 'InvenSense', 'mpn': 'MPU-6050', 'category': 'sensor', 'kind': 'imu', 'observed_property': 'acceleration|angular_velocity', 'feature_of_interest': 'device_orientation', 'vcc_min': 2.3, 'vcc_max': 3.4, 'iface': 'I2C', 'i2c_addr_default': '0x68', 'notes': '6-DOF'},
    {'part_label': 'ADXL345 Accelerometer', 'manufacturer': 'Analog Devices', 'mpn': 'ADXL345', 'category': 'sensor', 'kind': 'accelerometer', 'observed_property': 'acceleration', 'feature_of_interest': 'device_motion', 'vcc_min': 2.0, 'vcc_max': 3.6, 'iface': 'I2C|SPI', 'i2c_addr_default': '0x53'},
    
    # --- SENSORS (Light/Touch/Other) ---
    {'part_label': 'LDR Photoresistor', 'manufacturer': 'Generic', 'mpn': 'GL5528', 'category': 'sensor', 'kind': 'light', 'observed_property': 'illuminance', 'feature_of_interest': 'ambient_light', 'vcc_min': 0, 'vcc_max': 100, 'iface': 'ADC', 'notes': 'Passive component'},
    {'part_label': 'TSL2561 Lux Sensor', 'manufacturer': 'AMS', 'mpn': 'TSL2561', 'category': 'sensor', 'kind': 'light', 'observed_property': 'illuminance', 'feature_of_interest': 'ambient_light', 'vcc_min': 2.7, 'vcc_max': 3.6, 'iface': 'I2C', 'i2c_addr_default': '0x39'},
    {'part_label': 'Capacitive Touch TTP223', 'manufacturer': 'Generic', 'mpn': 'TTP223', 'category': 'sensor', 'kind': 'touch', 'observed_property': 'touch', 'feature_of_interest': 'user_input', 'vcc_min': 2.0, 'vcc_max': 5.5, 'iface': 'GPIO', 'notes': 'Single pad'},
    {'part_label': 'Soil Moisture Sensor', 'manufacturer': 'Generic', 'mpn': 'Capacitive Soil v1.2', 'category': 'sensor', 'kind': 'moisture', 'observed_property': 'soil_moisture', 'feature_of_interest': 'soil', 'vcc_min': 3.3, 'vcc_max': 5.5, 'iface': 'ADC', 'notes': 'Capacitive type (corrosion resistant)'},
    {'part_label': 'INA219 Current Sensor', 'manufacturer': 'TI', 'mpn': 'INA219', 'category': 'sensor', 'kind': 'current', 'observed_property': 'current|voltage|power', 'feature_of_interest': 'circuit_power', 'vcc_min': 3.0, 'vcc_max': 5.5, 'iface': 'I2C', 'i2c_addr_default': '0x40', 'notes': 'High side measure'},
    
    # --- ACTUATORS ---
    {'part_label': 'SG90 Micro Servo', 'manufacturer': 'TowerPro', 'mpn': 'SG90', 'category': 'actuator', 'kind': 'motor_servo', 'actuatable_property': 'angular_position', 'feature_of_interest': 'mechanical_arm', 'vcc_min': 4.8, 'vcc_max': 6.0, 'iface': 'PWM', 'range_min': 0, 'range_max': 180, 'units': 'deg'},
    {'part_label': 'MG996R High Torque Servo', 'manufacturer': 'TowerPro', 'mpn': 'MG996R', 'category': 'actuator', 'kind': 'motor_servo', 'actuatable_property': 'angular_position', 'feature_of_interest': 'mechanical_arm', 'vcc_min': 4.8, 'vcc_max': 7.2, 'iface': 'PWM', 'notes': 'Metal gear'},
    {'part_label': '28BYJ-48 Stepper + ULN2003', 'manufacturer': 'Generic', 'mpn': '28BYJ-48', 'category': 'actuator', 'kind': 'motor_stepper', 'actuatable_property': 'angular_position', 'feature_of_interest': 'precision_drive', 'vcc_min': 5.0, 'vcc_max': 5.0, 'iface': 'GPIO', 'notes': '4-phase 5-wire'},
    {'part_label': 'L298N Motor Driver', 'manufacturer': 'STMicro', 'mpn': 'L298N Module', 'category': 'actuator', 'kind': 'motor_driver', 'actuatable_property': 'motor_velocity', 'feature_of_interest': 'dc_motor', 'vcc_min': 5, 'vcc_max': 35, 'iface': 'GPIO|PWM', 'i_active_mA': 2000},
    {'part_label': 'TB6612FNG Driver', 'manufacturer': 'Toshiba', 'mpn': 'TB6612FNG', 'category': 'actuator', 'kind': 'motor_driver', 'actuatable_property': 'motor_velocity', 'feature_of_interest': 'dc_motor', 'vcc_min': 4.5, 'vcc_max': 13.5, 'iface': 'GPIO|PWM', 'i_active_mA': 1200, 'notes': 'Efficient dual H-bridge'},
    {'part_label': 'SSD1306 OLED 128x64', 'manufacturer': 'Generic', 'mpn': 'SSD1306', 'category': 'actuator', 'kind': 'display_oled', 'actuatable_property': 'visual_display', 'feature_of_interest': 'user_interface', 'vcc_min': 3.3, 'vcc_max': 5.0, 'iface': 'I2C', 'i2c_addr_default': '0x3C'},
    {'part_label': '16x2 LCD (I2C)', 'manufacturer': 'Generic', 'mpn': 'HD44780+PCF8574', 'category': 'actuator', 'kind': 'display_lcd', 'actuatable_property': 'visual_display', 'feature_of_interest': 'user_interface', 'vcc_min': 4.5, 'vcc_max': 5.5, 'iface': 'I2C', 'i2c_addr_default': '0x27'},
    {'part_label': 'WS2812B RGB LED', 'manufacturer': 'Worldsemi', 'mpn': 'WS2812B', 'category': 'actuator', 'kind': 'led_rgb', 'actuatable_property': 'color|brightness', 'feature_of_interest': 'indicator_light', 'vcc_min': 3.5, 'vcc_max': 5.3, 'iface': 'Digital (NZR)', 'notes': 'Neopixel compatible'},
    {'part_label': 'Relay Module 1-Ch', 'manufacturer': 'Generic', 'mpn': 'Relay 5V', 'category': 'actuator', 'kind': 'relay', 'actuatable_property': 'power_state', 'feature_of_interest': 'appliance_power', 'vcc_min': 5.0, 'vcc_max': 5.0, 'iface': 'GPIO', 'notes': 'Optoisolated'},
    {'part_label': 'Active Buzzer', 'manufacturer': 'Generic', 'mpn': 'Active Buzzer', 'category': 'actuator', 'kind': 'buzzer', 'actuatable_property': 'sound', 'feature_of_interest': 'alarm_signal', 'vcc_min': 3.3, 'vcc_max': 5.0, 'iface': 'GPIO'},
    
    # --- POWER ---
    {'part_label': 'LM2596 Buck Converter', 'manufacturer': 'Generic', 'mpn': 'LM2596', 'category': 'power', 'kind': 'regulator', 'vcc_min': 3.2, 'vcc_max': 40, 'notes': 'Step-down, adjustable'},
    {'part_label': 'AMS1117-3.3 LDO', 'manufacturer': 'AMS', 'mpn': 'AMS1117-3.3', 'category': 'power', 'kind': 'regulator', 'vcc_min': 4.5, 'vcc_max': 15, 'notes': '3.3V fixed output'},
    {'part_label': 'TP4056 LiPo Charger', 'manufacturer': 'Generic', 'mpn': 'TP4056', 'category': 'power', 'kind': 'charger', 'vcc_min': 4.5, 'vcc_max': 5.5, 'iface': 'USB', 'notes': '1A charging current'},
    {'part_label': '9V Battery Clip', 'manufacturer': 'Generic', 'mpn': 'Clip-9V', 'category': 'power', 'kind': 'battery', 'vcc_min': 9, 'vcc_max': 9},
    {'part_label': '18650 Battery Holder', 'manufacturer': 'Generic', 'mpn': 'Holder-18650', 'category': 'power', 'kind': 'battery', 'vcc_min': 3.7, 'vcc_max': 4.2},
    
    # --- TOOLING / MECHANICAL ---
    {'part_label': 'Breadboard 830', 'manufacturer': 'Generic', 'mpn': 'BB-830', 'category': 'tooling', 'kind': 'breadboard', 'notes': '830 tie points'},
    {'part_label': 'Jumper Wires M-M', 'manufacturer': 'Generic', 'mpn': 'Dupont M-M', 'category': 'tooling', 'kind': 'wire'},
    {'part_label': 'Resistor Kit', 'manufacturer': 'Generic', 'mpn': 'Resistor Assortment', 'category': 'tooling', 'kind': 'resistor', 'notes': '1/4W 1% Metal Film'},
    {'part_label': 'Logic Level Converter', 'manufacturer': 'Generic', 'mpn': 'Logic Level 4-Ch', 'category': 'tooling', 'kind': 'level_shifter', 'vcc_min': 3.3, 'vcc_max': 5.0, 'notes': 'Bi-directional'}
]

def main():
    # 1. Load Existing Data
    if os.path.exists(TARGET_CSV):
        print(f"Reading existing file: {TARGET_CSV}")
        df = pd.read_csv(TARGET_CSV)
    elif os.path.exists(os.path.join(os.getcwd(), TARGET_CSV)):
        # Fallback if TARGET_CSV was just filename but running in data-entry
        TARGET_CSV_PATH = os.path.join(os.getcwd(), TARGET_CSV)
        print(f"Reading existing file: {TARGET_CSV_PATH}")
        df = pd.read_csv(TARGET_CSV_PATH)
    else:
        # Check if the file name is just a name and we are in data-entry
        if os.path.basename(TARGET_CSV) == TARGET_CSV and os.path.basename(os.getcwd()) == 'data-entry':
             print(f"Reading existing file in current dir: {TARGET_CSV}")
             try:
                 df = pd.read_csv(TARGET_CSV)
             except FileNotFoundError:
                 print(f"Creating new file: {TARGET_CSV}")
                 df = pd.DataFrame()
        else:
             print(f"Creating new file: {TARGET_CSV}")
             df = pd.DataFrame()

    # 2. Check for Duplicates (don't add if part_label or mpn already exists)
    existing_labels = set(df['part_label'].dropna().astype(str).str.lower()) if 'part_label' in df.columns else set()
    existing_mpns = set(df['mpn'].dropna().astype(str).str.lower()) if 'mpn' in df.columns else set()

    new_parts = []
    added_count = 0

    for part in STANDARD_PARTS:
        label = str(part.get('part_label', '')).lower()
        mpn = str(part.get('mpn', '')).lower()
        
        if label in existing_labels or (mpn and mpn in existing_mpns):
            continue # Skip duplicate
            
        new_parts.append(part)
        added_count += 1

    # 3. Append New Parts
    if new_parts:
        new_df = pd.DataFrame(new_parts)
        # Combine
        if not df.empty:
            df = pd.concat([df, new_df], ignore_index=True, sort=False)
        else:
            df = new_df
            
        # 4. Save
        # Only try to make directory if dirname is not empty
        output_dir = os.path.dirname(TARGET_CSV)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        # Ensure column order matches our refined standard (optional but good practice)
        PREFERRED_ORDER = [
            'manufacturer', 'mpn', 'part_label', 'category', 'kind',
            'observed_property', 'actuatable_property', 'feature_of_interest',
            'vcc_min', 'vcc_max', 'logic_level', 'i_active_mA', 'i_idle_uA',
            'iface', 'i2c_addr_default', 'i2c_addr_range', 'spi_max_mhz', 'uart_baud',
            'sample_rate_max_hz', 'latency_ms', 'accuracy_pct', 'range_min', 'range_max', 'units',
            'datasheet_url', 'product_url', 'offer_price', 'currency', 'lifecycle', 'notes'
        ]
        
        # Add any missing columns to df
        for col in PREFERRED_ORDER:
            if col not in df.columns:
                df[col] = None
        
        # Reorder columns that exist in PREFERRED_ORDER, keep others at the end
        existing_cols = df.columns.tolist()
        final_order = [c for c in PREFERRED_ORDER if c in existing_cols] + [c for c in existing_cols if c not in PREFERRED_ORDER]
        df = df[final_order]

        df.to_csv(TARGET_CSV, index=False)
        print(f"Success! Added {added_count} new standard parts to {TARGET_CSV}")
    else:
        print("No new parts to add. Your library already contains these standard parts.")

if __name__ == "__main__":
    main()
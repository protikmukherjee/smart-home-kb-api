import pandas as pd
import os
import numpy as np

# --- CONFIGURATION ---
TARGET_CSV = 'data-entry/iotkb_priced.csv'

# --- THE STANDARD LIBRARY (Rich Semantic Data) ---
# [Keep the exact same STANDARD_PARTS list from before - it was correct]
# ... (I am not repeating the huge list to save space, but ensure it is there!) ...
STANDARD_PARTS = [
    # ... insert the full list from the previous response here ...
    # Controllers
    {'part_label': 'Arduino Uno', 'mpn': 'A000066', 'category': 'controller', 'kind': 'arduino', 'vcc_min': 7, 'vcc_max': 12, 'logic_level': 5.0, 'iface': 'UART|I2C|SPI|ADC|GPIO'},
    {'part_label': 'Arduino Nano', 'mpn': 'A000005', 'category': 'controller', 'kind': 'arduino', 'vcc_min': 7, 'vcc_max': 12, 'logic_level': 5.0, 'iface': 'UART|I2C|SPI|ADC|GPIO'},
    {'part_label': 'ESP32', 'mpn': 'ESP32-WROOM-32', 'category': 'controller', 'kind': 'esp32', 'vcc_min': 2.2, 'vcc_max': 3.6, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|I2S|ADC|DAC|GPIO'},
    {'part_label': 'ESP8266', 'mpn': 'ESP8266', 'category': 'controller', 'kind': 'esp8266', 'vcc_min': 2.5, 'vcc_max': 3.6, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|ADC|GPIO'},
    {'part_label': 'Raspberry Pi 4', 'mpn': 'RPI4', 'category': 'controller', 'kind': 'sbc', 'vcc_min': 5.0, 'vcc_max': 5.25, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|GPIO|HDMI|USB'},
    {'part_label': 'Raspberry Pi Pico', 'mpn': 'SC0915', 'category': 'controller', 'kind': 'microcontroller', 'vcc_min': 1.8, 'vcc_max': 5.5, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|ADC|GPIO'},
    
    # Sensors
    {'part_label': 'DHT11', 'mpn': 'DHT11', 'category': 'sensor', 'kind': 'temp_humidity', 'observed_property': 'temperature|humidity', 'feature_of_interest': 'room_air', 'vcc_min': 3.5, 'vcc_max': 5.5, 'iface': 'Digital'},
    {'part_label': 'DHT22', 'mpn': 'DHT22', 'category': 'sensor', 'kind': 'temp_humidity', 'observed_property': 'temperature|humidity', 'feature_of_interest': 'room_air', 'vcc_min': 3.3, 'vcc_max': 6.0, 'iface': 'Digital'},
    {'part_label': 'BME280', 'mpn': 'BME280', 'category': 'sensor', 'kind': 'environment', 'observed_property': 'temperature|humidity|pressure', 'feature_of_interest': 'room_air', 'vcc_min': 1.8, 'vcc_max': 3.6, 'iface': 'I2C|SPI'},
    {'part_label': 'HC-SR04', 'mpn': 'HC-SR04', 'category': 'sensor', 'kind': 'distance', 'observed_property': 'distance', 'feature_of_interest': 'obstacle_proximity', 'vcc_min': 4.5, 'vcc_max': 5.5, 'logic_level': 5.0, 'iface': 'GPIO_TRIGGER_ECHO'},
    {'part_label': 'HC-SR501', 'mpn': 'HC-SR501', 'category': 'sensor', 'kind': 'motion', 'observed_property': 'motion', 'feature_of_interest': 'human_presence', 'vcc_min': 4.5, 'vcc_max': 20, 'logic_level': 3.3, 'iface': 'GPIO'},
    {'part_label': 'DS18B20', 'mpn': 'DS18B20', 'category': 'sensor', 'kind': 'temperature', 'observed_property': 'temperature', 'feature_of_interest': 'liquid', 'vcc_min': 3.0, 'vcc_max': 5.5, 'iface': 'OneWire'},
    
    # Actuators
    {'part_label': 'SG90 Servo', 'mpn': 'SG90', 'category': 'actuator', 'kind': 'motor_servo', 'actuatable_property': 'angular_position', 'feature_of_interest': 'mechanical_arm', 'vcc_min': 4.8, 'vcc_max': 6.0, 'iface': 'PWM'},
    {'part_label': 'SSD1306 OLED', 'mpn': 'SSD1306', 'category': 'actuator', 'kind': 'display_oled', 'actuatable_property': 'visual_display', 'feature_of_interest': 'user_interface', 'vcc_min': 3.3, 'vcc_max': 5.0, 'iface': 'I2C'},
    {'part_label': 'L298N', 'mpn': 'L298N', 'category': 'actuator', 'kind': 'motor_driver', 'actuatable_property': 'motor_velocity', 'feature_of_interest': 'dc_motor', 'vcc_min': 5, 'vcc_max': 35, 'iface': 'GPIO|PWM'}
]

def main():
    if not os.path.exists(TARGET_CSV):
        print(f"Error: {TARGET_CSV} not found.")
        return

    print(f"Reading {TARGET_CSV}...")
    df = pd.read_csv(TARGET_CSV)

    # Clean up string columns to ensure matching works
    df['part_label'] = df['part_label'].astype(str)
    df['mpn'] = df['mpn'].astype(str)

    updates_count = 0
    
    print("Repairing rows with rich semantic data...")
    
    for index, row in df.iterrows():
        row_label = row['part_label'].lower()
        row_mpn = row['mpn'].lower()
        
        match_found = None
        
        # Heuristic Matching
        for part in STANDARD_PARTS:
            std_mpn = part.get('mpn', '').lower()
            std_label = part.get('part_label', '').lower()
            
            # 1. Strong Match: MPN contains key string (e.g. 'hc-sr04' in 'Ultrasonic HC-SR04')
            if std_mpn and std_mpn in row_mpn:
                match_found = part
                break
            
            # 2. Weak Match: Label contains standard label
            if std_label in row_label:
                match_found = part
                break
        
        if match_found:
            # FORCE UPDATE semantic fields
            # We skip 'part_label' and 'mpn' to keep the original identity
            # We skip 'offer_price' and 'currency' to keep the live pricing
            skip_cols = ['part_label', 'mpn', 'offer_price', 'currency']
            
            for key, val in match_found.items():
                if key not in skip_cols:
                    df.at[index, key] = val
            
            # print(f"  -> Updated {row['part_label']}") # Uncomment for verbosity
            updates_count += 1

    # Save
    df.to_csv(TARGET_CSV, index=False)
    print(f"Success! Enriched {updates_count} rows with full specs.")

if __name__ == "__main__":
    main()
import pandas as pd
import numpy as np
import os
import re

# --- CONFIGURATION ---
INPUT_FILE = 'iotkb_seed_merged.csv'
OUTPUT_FILE = 'iotkb_refined.csv'

# --- DETECTION RULES ---
# Format: (Category, Kind, [List of Keywords to Search in Label/MPN])
# Order matters: Search for specific items before generic ones.
DETECTION_RULES = [
    # --- CONTROLLERS ---
    ('controller', 'esp32', ['esp32', 'esp-32', 'wroom']),
    ('controller', 'esp8266', ['esp8266', 'nodemcu', 'd1 mini']),
    ('controller', 'arduino', ['arduino', 'atmega', 'uno', 'nano', 'mega', 'pro mini', 'lilypad']),
    ('controller', 'rpi', ['raspberry pi', 'rpi', 'zero w', 'compute module']),
    ('controller', 'microbit', ['micro:bit', 'microbit']),
    ('controller', 'teensy', ['teensy']),
    ('controller', 'stm32', ['stm32']),
    ('controller', 'feather', ['feather']),
    ('controller', 'particle', ['particle', 'photon', 'electron', 'argon', 'boron']),
    
    # --- SENSORS ---
    ('sensor', 'accelerometer', ['accelerometer', 'adxl', 'lis3', 'mma7', 'bma180']),
    ('sensor', 'gyro', ['gyro', 'itg-', 'l3g']),
    ('sensor', 'imu', ['imu', 'mpu-', '9-dof', '6-dof', 'lsm9ds']),
    ('sensor', 'magnetometer', ['magnetometer', 'mag', 'compass', 'hmc', 'mag3110']),
    ('sensor', 'temp_humidity', ['temp', 'humidity', 'dht11', 'dht22', 'bme280', 'bmp180', 'sht1', 'sht2', 'si70', 'hih', 'tmp36', 'tmp102']),
    ('sensor', 'gas', ['gas sensor', 'mq-', 'co2', 'ccs811', 'sgp30', 'air quality']),
    ('sensor', 'light', ['light sensor', 'lux', 'tsl25', 'ldr', 'photocell', 'photoresistor', 'ambient light']),
    ('sensor', 'color', ['color sensor', 'tcs3200', 'tcs34725']),
    ('sensor', 'distance', ['distance', 'ultrasonic', 'hc-sr04', 'sonar', 'range finder', 'lidar', 'vl53l0x', 'sharp ir']),
    ('sensor', 'motion', ['motion', 'pir', 'human presence', 'hc-sr501']),
    ('sensor', 'flex_force', ['flex sensor', 'force sensitive', 'fsr']),
    ('sensor', 'current', ['current sensor', 'acs712', 'ina219', 'ina226']),
    ('sensor', 'gps', ['gps', 'gnss', 'ublox', 'venus', 'copernicus']),
    ('sensor', 'rtc', ['rtc', 'real time clock', 'ds1307', 'ds3231', 'pcf8523']),
    ('sensor', 'touch', ['capacitive touch', 'mpr121', 'touch sensor']),
    ('sensor', 'microphone', ['microphone', 'electret', 'mems mic']),
    
    # --- ACTUATORS ---
    ('actuator', 'motor_driver', ['motor driver', 'h-bridge', 'l298', 'tb6612', 'drv88', 'easydriver', 'stepper driver']),
    ('actuator', 'motor_servo', ['servo']),
    ('actuator', 'motor_stepper', ['stepper motor']),
    ('actuator', 'motor_dc', ['dc motor', 'gearbox', 'vibration motor']),
    ('actuator', 'display_lcd', ['lcd', 'liquid crystal']),
    ('actuator', 'display_oled', ['oled', 'ssd1306']),
    ('actuator', 'display_epaper', ['e-paper', 'epaper', 'e-ink']),
    ('actuator', 'display_segment', ['segment display', '7-segment', 'matrix led']),
    ('actuator', 'led_rgb', ['rgb led', 'neopixel', 'ws2812', 'dotstar']),
    ('actuator', 'led', ['led', 'light emitting diode']),
    ('actuator', 'buzzer', ['buzzer', 'speaker', 'piezo']),
    ('actuator', 'relay', ['relay']),
    ('actuator', 'pump', ['pump', 'solenoid']),
    
    # --- POWER ---
    ('power', 'battery', ['battery', 'lipo', 'li-ion', 'coin cell', 'aa holder', 'aaa holder']),
    ('power', 'regulator', ['regulator', 'buck', 'boost', 'converter', 'ldo', 'lm7805', 'voltage regulator']),
    ('power', 'charger', ['charger', 'lipoly', 'mcp73831']),
    ('power', 'adapter', ['adapter', 'power supply', 'wall wart']),
    ('power', 'solar', ['solar']),
    
    # --- MECHANICAL ---
    ('mechanical', 'connector', ['header', 'terminal block', 'connector', 'jack', 'socket', 'jst']),
    ('mechanical', 'mounting', ['standoff', 'screw', 'bracket', 'mount']),
    ('mechanical', 'switch', ['switch', 'button', 'dip switch', 'tactile']),
    
    # --- TOOLING (Default Fallbacks) ---
    ('tooling', 'breadboard', ['breadboard', 'protoboard']),
    ('tooling', 'wire', ['jumper wire', 'wire']),
    ('tooling', 'resistor', ['resistor']),
    ('tooling', 'capacitor', ['capacitor', 'cap ceramic', 'cap electrolytic']),
    ('tooling', 'diode', ['diode', 'zener', 'rectifier']),
    ('tooling', 'transistor', ['transistor', 'mosfet', 'bjt', 'npn', 'pnp']),
    ('tooling', 'ic', ['ic', 'chip', 'logic', 'eeprom', 'flash', 'sram', 'multiplexer', 'shifter']),
    ('tooling', 'breakout', ['breakout', 'adapter board'])
]

def detect_category_and_kind(row):
    # Combine label, mpn, and notes for search text
    text = str(row.get('part_label', '')).lower() + " " + \
           str(row.get('mpn', '')).lower() + " " + \
           str(row.get('notes', '')).lower()
    
    # If category is already set and NOT 'tooling' (or 'Tool'), trust the user's manual entry
    current_cat = str(row.get('category', '')).lower()
    current_kind = str(row.get('kind', '')).lower()
    
    # Trust specific manual entries (except generic 'tool' or 'tooling')
    if current_cat in ['sensor', 'actuator', 'controller', 'power', 'mechanical'] and current_cat != 'tooling':
        # If kind is missing, try to detect kind only within that category
        if not current_kind or current_kind == 'nan':
            for cat, kind, keywords in DETECTION_RULES:
                if cat == current_cat:
                    for kw in keywords:
                        if kw in text:
                            return cat, kind
            return current_cat, 'generic' # Keep existing cat, mark generic kind
        return current_cat, current_kind

    # Otherwise, run full detection
    for cat, kind, keywords in DETECTION_RULES:
        for kw in keywords:
            if kw in text:
                return cat, kind
    
    # Fallback for truly unknown items
    return 'tooling', 'component'

def main():
    # 1. Load Data
    print(f"Reading {INPUT_FILE}...")
    try:
        df = pd.read_csv(INPUT_FILE)
    except FileNotFoundError:
        # Fallback for checking data-entry folder
        df = pd.read_csv(os.path.join('data-entry', INPUT_FILE))

    # 2. Normalize Columns
    if 'category' not in df.columns and 'part_type' in df.columns:
        df.rename(columns={'part_type': 'category'}, inplace=True)
    if 'kind' not in df.columns and 'part_kind' in df.columns:
        df.rename(columns={'part_kind': 'kind'}, inplace=True)
    
    # 3. Apply Detection
    print("Auto-categorizing parts...")
    new_cats = []
    new_kinds = []
    
    for index, row in df.iterrows():
        cat, kind = detect_category_and_kind(row)
        new_cats.append(cat)
        new_kinds.append(kind)
        
    df['category'] = new_cats
    df['kind'] = new_kinds

    # 4. Standardize Structure (Add recommended fields, remove junk)
    FINAL_COLUMNS = [
        'manufacturer', 'mpn', 'part_label',
        'category', 'kind',
        'observed_property', 'actuatable_property', 'feature_of_interest',
        'vcc_min', 'vcc_max', 'logic_level', 'i_active_mA', 'i_idle_uA',
        'package_case', 'pin_count', 'temp_min_c', 'temp_max_c',
        'iface', 'i2c_addr_default', 'i2c_addr_range', 'spi_max_mhz', 'uart_baud',
        'sample_rate_max_hz', 'latency_ms', 'accuracy_pct', 'range_min', 'range_max', 'units',
        'datasheet_url', 'product_url', 'offer_price', 'currency', 'lifecycle', 'notes'
    ]
    
    # Add missing columns
    for col in FINAL_COLUMNS:
        if col not in df.columns:
            df[col] = np.nan
            
    # Remove unnamed
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    
    # Reorder
    df_final = df[FINAL_COLUMNS]

    # 5. Save
    os.makedirs('data-entry', exist_ok=True)
    df_final.to_csv(OUTPUT_FILE, index=False)
    print(f"Success! Categorized {len(df_final)} parts.")
    print(f"Saved to {OUTPUT_FILE}")

    # 6. Print Stats
    print("\nCategorization Results:")
    print(df_final['category'].value_counts())

if __name__ == "__main__":
    main()
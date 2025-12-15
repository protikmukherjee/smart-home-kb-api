import pandas as pd
import numpy as np
import os
import re

# --- CONFIGURATION ---
INPUT_FILE = 'iotkb_seed_merged.csv'
OUTPUT_FILE = 'iotkb_enriched.csv'

# --- KNOWLEDGE BASE (The "Brain") ---
# This maps specific keywords to known technical specifications.
# If a part matches the keyword, these values are injected IF the CSV fields are empty.
KNOWLEDGE_BASE = {
    # --- CONTROLLERS ---
    'esp32': {
        'category': 'controller', 'kind': 'esp32',
        'vcc_min': 2.2, 'vcc_max': 3.6, 'logic_level': 3.3,
        'iface': 'UART|I2C|SPI|I2S|ADC|DAC|GPIO', 'clock_mhz': 240,
        'manufacturer': 'Espressif/Generic', 'notes': 'Dual-core, WiFi+BT'
    },
    'esp8266': {
        'category': 'controller', 'kind': 'esp8266',
        'vcc_min': 2.5, 'vcc_max': 3.6, 'logic_level': 3.3,
        'iface': 'UART|I2C|SPI|ADC|GPIO', 'clock_mhz': 80,
        'notes': 'WiFi SoC'
    },
    'arduino uno': {
        'category': 'controller', 'kind': 'arduino',
        'vcc_min': 7, 'vcc_max': 12, 'logic_level': 5.0, # Vin limits
        'iface': 'UART|I2C|SPI|ADC|GPIO',
        'manufacturer': 'Arduino', 'notes': 'ATmega328P based'
    },
    'raspberry pi 4': {
        'category': 'controller', 'kind': 'sbc',
        'vcc_min': 5.0, 'vcc_max': 5.0, 'logic_level': 3.3,
        'iface': 'UART|I2C|SPI|GPIO',
        'manufacturer': 'Raspberry Pi', 'notes': 'High power consumption'
    },

    # --- SENSORS ---
    'dht11': {
        'category': 'sensor', 'kind': 'temp_humidity',
        'observed_property': 'temperature|humidity',
        'vcc_min': 3.5, 'vcc_max': 5.5, 'iface': 'Digital (Single Bus)',
        'range_min': 0, 'range_max': 50, 'units': 'degC',
        'accuracy_pct': 5, 'notes': 'Slow sensor, 1Hz max'
    },
    'dht22': {
        'category': 'sensor', 'kind': 'temp_humidity',
        'observed_property': 'temperature|humidity',
        'vcc_min': 3.3, 'vcc_max': 6.0, 'iface': 'Digital (Single Bus)',
        'range_min': -40, 'range_max': 80, 'units': 'degC',
        'accuracy_pct': 2
    },
    'bme280': {
        'category': 'sensor', 'kind': 'environment',
        'observed_property': 'temperature|humidity|pressure',
        'vcc_min': 1.7, 'vcc_max': 3.6, 'iface': 'I2C|SPI',
        'i2c_addr_default': '0x76', 'i2c_addr_range': '0x76-0x77',
        'notes': 'Precision Bosch sensor'
    },
    'hc-sr04': {
        'category': 'sensor', 'kind': 'distance',
        'observed_property': 'distance',
        'feature_of_interest': 'obstacle_proximity',
        'vcc_min': 4.5, 'vcc_max': 5.5, 'logic_level': 5.0,
        'iface': 'GPIO_TRIGGER_ECHO',
        'range_min': 2, 'range_max': 400, 'units': 'cm'
    },
    'hc-sr501': {
        'category': 'sensor', 'kind': 'motion',
        'observed_property': 'motion',
        'feature_of_interest': 'human_presence',
        'vcc_min': 4.5, 'vcc_max': 20.0, 'logic_level': 3.3, # Output is 3.3V
        'iface': 'GPIO'
    },
    'ds3231': {
        'category': 'sensor', 'kind': 'rtc',
        'observed_property': 'time',
        'vcc_min': 2.3, 'vcc_max': 5.5, 'iface': 'I2C',
        'i2c_addr_default': '0x68', 'notes': 'Highly accurate TCXO'
    },
    'mpu-6050': {
        'category': 'sensor', 'kind': 'imu',
        'observed_property': 'acceleration|angular_velocity',
        'vcc_min': 2.3, 'vcc_max': 3.4, 'iface': 'I2C',
        'i2c_addr_default': '0x68', 'notes': '6-DOF'
    },

    # --- ACTUATORS ---
    'sg90': {
        'category': 'actuator', 'kind': 'motor_servo',
        'actuatable_property': 'angular_position',
        'vcc_min': 4.8, 'vcc_max': 6.0, 'iface': 'PWM',
        'range_min': 0, 'range_max': 180, 'units': 'degrees'
    },
    'ssd1306': {
        'category': 'actuator', 'kind': 'display_oled',
        'actuatable_property': 'visual_display',
        'vcc_min': 3.3, 'vcc_max': 5.0, 'iface': 'I2C|SPI',
        'i2c_addr_default': '0x3C'
    },
    'l298n': {
        'category': 'actuator', 'kind': 'motor_driver',
        'actuatable_property': 'motor_velocity',
        'vcc_min': 5, 'vcc_max': 35, 'iface': 'GPIO|PWM',
        'i_active_mA': 2000, 'notes': 'Inefficient, needs heat sink'
    }
}

# --- DETECTION RULES (Fallback) ---
# Used if no specific Knowledge Base entry is matched
DETECTION_RULES = [
    # (Category, Kind, [Keywords])
    ('controller', 'microcontroller', ['microcontroller', 'mcu', 'board', 'eval']),
    ('sensor', 'light', ['light', 'lux', 'ldr', 'photo']),
    ('sensor', 'gas', ['gas', 'co2', 'air quality']),
    ('sensor', 'distance', ['distance', 'ultrasonic', 'lidar', 'proximity']),
    ('actuator', 'motor_dc', ['motor', 'gearbox', 'fan']),
    ('actuator', 'led', ['led', 'neopixel']),
    ('power', 'battery', ['battery', 'lipo', 'holder']),
    ('power', 'regulator', ['regulator', 'buck', 'boost', 'ldo']),
    ('tooling', 'connector', ['header', 'terminal', 'socket']),
    ('tooling', 'resistor', ['resistor']),
    ('tooling', 'capacitor', ['capacitor']),
]

def enrich_row(row):
    # Create search text
    text = str(row.get('part_label', '')).lower() + " " + \
           str(row.get('mpn', '')).lower() + " " + \
           str(row.get('notes', '')).lower()
    
    # 1. Try Specific Knowledge Base Match
    for keyword, specs in KNOWLEDGE_BASE.items():
        if keyword in text:
            # Apply specs
            for field, value in specs.items():
                # Only fill if empty (or if forcing categorization updates)
                if pd.isna(row.get(field)) or str(row.get(field)) == '' or str(row.get(field)) == 'nan':
                    row[field] = value
                # Special handling: Override category/kind if it was previously generic "tooling"
                if field in ['category', 'kind']:
                    curr_cat = str(row.get('category', '')).lower()
                    if curr_cat == 'tooling' or curr_cat == 'nan':
                        row[field] = value
            return row

    # 2. Fallback Detection Rules (Category/Kind Only)
    current_cat = str(row.get('category', '')).lower()
    
    # If category is missing or 'tooling', try to guess
    if current_cat == 'tooling' or current_cat == 'nan' or current_cat == '':
        for cat, kind, keywords in DETECTION_RULES:
            for kw in keywords:
                if kw in text:
                    row['category'] = cat
                    row['kind'] = kind
                    return row
    
    return row

def main():
    print(f"Reading {INPUT_FILE}...")
    try:
        df = pd.read_csv(INPUT_FILE)
    except FileNotFoundError:
        df = pd.read_csv(os.path.join('data-entry', INPUT_FILE))

    # Standardize Column Names first
    if 'category' not in df.columns and 'part_type' in df.columns:
        df.rename(columns={'part_type': 'category'}, inplace=True)
    if 'kind' not in df.columns and 'part_kind' in df.columns:
        df.rename(columns={'part_kind': 'kind'}, inplace=True)

    # Ensure all columns exist before we start
    ALL_COLS = [
        'manufacturer', 'mpn', 'part_label', 'category', 'kind',
        'observed_property', 'actuatable_property', 'feature_of_interest',
        'vcc_min', 'vcc_max', 'logic_level', 'i_active_mA', 'i_idle_uA',
        'iface', 'i2c_addr_default', 'i2c_addr_range',
        'sample_rate_max_hz', 'range_min', 'range_max', 'units',
        'datasheet_url', 'product_url', 'notes'
    ]
    for col in ALL_COLS:
        if col not in df.columns:
            df[col] = np.nan

    print("Enriching database with specifications...")
    # Apply enrichment row by row
    df = df.apply(enrich_row, axis=1)

    # Reorder and Clean
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    df.to_csv(OUTPUT_FILE, index=False)
    
    print(f"Success! Enriched database saved to {OUTPUT_FILE}")
    print(f"Total parts: {len(df)}")
    print("\nBreakdown by Category:")
    print(df['category'].value_counts())

if __name__ == "__main__":
    main()
import pandas as pd
import os

# --- CONFIGURATION ---
TARGET_CSV = 'data-entry/iotkb_refined.csv'

# --- THE EXPANSION PACK (Rich Semantic Data) ---
STANDARD_PARTS = [
    # --- CONTROLLERS ---
    {'part_label': 'Arduino Pro Micro 5V', 'manufacturer': 'SparkFun', 'mpn': 'DEV-12640', 'category': 'controller', 'kind': 'arduino', 'vcc_min': 4.5, 'vcc_max': 5.5, 'logic_level': 5.0, 'iface': 'UART|I2C|SPI|USB', 'notes': 'ATmega32U4'},
    {'part_label': 'Adafruit Feather M0 Basic', 'manufacturer': 'Adafruit', 'mpn': '2772', 'category': 'controller', 'kind': 'feather', 'vcc_min': 3.3, 'vcc_max': 6.0, 'logic_level': 3.3, 'iface': 'UART|I2C|SPI|USB', 'notes': 'ATSAMD21 Cortex M0'},
    {'part_label': 'NVIDIA Jetson Nano', 'manufacturer': 'NVIDIA', 'mpn': '945-13450-0000-100', 'category': 'controller', 'kind': 'sbc', 'vcc_min': 5.0, 'vcc_max': 5.0, 'iface': 'UART|I2C|SPI|CSI|HDMI', 'notes': 'AI/ML Edge Computing'},

    # --- SENSORS (Rich Semantics) ---
    {'part_label': 'BNO055 Absolute Orientation', 'manufacturer': 'Bosch', 'mpn': 'BNO055', 'category': 'sensor', 'kind': 'imu', 
     'observed_property': 'orientation|acceleration|magnetic_field', 'feature_of_interest': 'device_orientation', 
     'vcc_min': 2.4, 'vcc_max': 3.6, 'iface': 'I2C|UART', 'notes': 'On-board sensor fusion'},
     
    {'part_label': 'SGP30 TVOC/eCO2 Gas', 'manufacturer': 'Sensirion', 'mpn': 'SGP30', 'category': 'sensor', 'kind': 'gas', 
     'observed_property': 'TVOC|eCO2', 'feature_of_interest': 'indoor_air_quality', 
     'vcc_min': 1.6, 'vcc_max': 1.9, 'iface': 'I2C', 'i2c_addr_default': '0x58'},

    {'part_label': 'VL53L1X Long Range ToF', 'manufacturer': 'STMicro', 'mpn': 'VL53L1X', 'category': 'sensor', 'kind': 'distance', 
     'observed_property': 'distance', 'feature_of_interest': 'obstacle_proximity', 
     'vcc_min': 2.6, 'vcc_max': 3.5, 'iface': 'I2C', 'range_max': 400, 'units': 'cm'},

    {'part_label': 'HC-SR04 Ultrasonic', 'manufacturer': 'Generic', 'mpn': 'HC-SR04', 'category': 'sensor', 'kind': 'distance', 
     'observed_property': 'distance', 'feature_of_interest': 'obstacle_proximity', 
     'vcc_min': 4.5, 'vcc_max': 5.5, 'logic_level': 5.0, 'iface': 'GPIO_TRIGGER_ECHO', 'range_min': 2, 'range_max': 400, 'units': 'cm'},

    {'part_label': 'DHT22 (AM2302)', 'manufacturer': 'Generic', 'mpn': 'DHT22', 'category': 'sensor', 'kind': 'temp_humidity', 
     'observed_property': 'temperature|humidity', 'feature_of_interest': 'ambient_air', 
     'vcc_min': 3.3, 'vcc_max': 6.0, 'iface': 'Digital', 'accuracy_pct': 2, 'range_min': -40, 'range_max': 80, 'units': 'degC'},

    # --- ACTUATORS (Rich Semantics) ---
    {'part_label': 'NEMA 17 Stepper Motor', 'manufacturer': 'Generic', 'mpn': '17HS4401', 'category': 'actuator', 'kind': 'motor_stepper', 
     'actuatable_property': 'angular_position', 'feature_of_interest': 'linear_axis', 
     'vcc_min': 12, 'vcc_max': 24, 'iface': 'DRIVEN_BY_DRIVER', 'notes': 'Bipolar 4-wire'},

    {'part_label': 'MG996R High Torque Servo', 'manufacturer': 'TowerPro', 'mpn': 'MG996R', 'category': 'actuator', 'kind': 'motor_servo', 
     'actuatable_property': 'angular_position', 'feature_of_interest': 'robotic_joint', 
     'vcc_min': 4.8, 'vcc_max': 7.2, 'iface': 'PWM', 'notes': 'Metal gear'},

    {'part_label': 'Solenoid Valve 12V', 'manufacturer': 'Generic', 'mpn': 'Solenoid 1/2"', 'category': 'actuator', 'kind': 'valve', 
     'actuatable_property': 'fluid_flow', 'feature_of_interest': 'liquid_pipe', 
     'vcc_min': 12, 'vcc_max': 12, 'iface': 'POWER_SWITCHED', 'notes': 'Normally closed'},

    {'part_label': 'NeoPixel Jewel 7', 'manufacturer': 'Adafruit', 'mpn': '2226', 'category': 'actuator', 'kind': 'led_rgb', 
     'actuatable_property': 'luminous_color|brightness', 'feature_of_interest': 'visual_indicator', 
     'vcc_min': 3.5, 'vcc_max': 5.5, 'iface': 'Digital (NZR)'},
]

def main():
    # 1. Load Existing Data
    if os.path.exists(TARGET_CSV):
        print(f"Reading existing file: {TARGET_CSV}")
        df = pd.read_csv(TARGET_CSV)
    elif os.path.exists(os.path.join(os.getcwd(), TARGET_CSV)):
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

    # 2. Upsert Logic (Update or Insert)
    # We use 'part_label' as the primary key for matching
    
    # Ensure all target columns exist in DF
    for key in STANDARD_PARTS[0].keys():
        if key not in df.columns:
            df[key] = None

    updates_count = 0
    adds_count = 0
    
    # Convert dataframe to a list of dicts for easier manipulation, then rebuild
    # This is less efficient for massive data but fine for <5000 rows
    
    # Index existing rows by part_label (lowercase)
    existing_map = {}
    if not df.empty and 'part_label' in df.columns:
        for idx, row in df.iterrows():
            label = str(row['part_label']).lower().strip()
            existing_map[label] = idx

    for part in STANDARD_PARTS:
        label = str(part.get('part_label', '')).lower().strip()
        
        if label in existing_map:
            # UPDATE existing row
            idx = existing_map[label]
            # Update specific semantic fields
            df.at[idx, 'observed_property'] = part.get('observed_property', df.at[idx, 'observed_property'])
            df.at[idx, 'actuatable_property'] = part.get('actuatable_property', df.at[idx, 'actuatable_property'])
            df.at[idx, 'feature_of_interest'] = part.get('feature_of_interest', df.at[idx, 'feature_of_interest'])
            df.at[idx, 'iface'] = part.get('iface', df.at[idx, 'iface'])
            df.at[idx, 'vcc_min'] = part.get('vcc_min', df.at[idx, 'vcc_min'])
            df.at[idx, 'vcc_max'] = part.get('vcc_max', df.at[idx, 'vcc_max'])
            updates_count += 1
        else:
            # INSERT new row
            new_row = pd.DataFrame([part])
            df = pd.concat([df, new_row], ignore_index=True)
            adds_count += 1

    # 3. Save
    output_dir = os.path.dirname(TARGET_CSV)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    # Ensure column order
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
    print(f"Success! Updated {updates_count} existing parts and added {adds_count} new parts.")

if __name__ == "__main__":
    main()
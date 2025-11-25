# tools/import_fritzing_zip.py
import os
import glob
import xml.etree.ElementTree as ET
import csv
import sys
import re
import requests
import zipfile
import io

# --- CONFIGURATION ---
OUTPUT_CSV = 'data-entry/fritzing_import.csv'
REPO_ZIP_URL = 'https://github.com/fritzing/fritzing-parts/archive/refs/heads/master.zip'

# Mapping from Fritzing tags to your 6 categories
TAG_TO_PART_TYPE_MAP = {
    # Specific controllers
    'controller': ['controller', 'microcontroller', 'arduino', 'esp32', 'rpi', 'raspberry pi', 'teensy', 'mcu', 'cpu', 'board', 'esp8266'],
    # Specific sensors
    'sensor': ['sensor', 'light', 'motion', 'distance', 'gas', 'flame', 'environment', 'temp', 'humidity', 'current', 'ina226', 'ds18b20', 'rtc', 'switch', 'pir', 'ultrasonic', 'gyro', 'accel'],
    # Specific actuators
    'actuator': ['actuator', 'motor', 'led', 'buzzer', 'relay', 'servo', 'pump', 'display', 'lcd', 'oled'],
    # Power-specific items (not just passives)
    'power': ['power supply', 'regulator', 'battery', 'vcc', 'gnd', 'power', 'converter', 'buck', 'boost'],
    # Mechanical parts
    'mechanical': ['mechanical', 'screw', 'mount', 'bracket', 'enclosure', 'wheel', 'chassis', 'standoff', 'holder'],
    # Default/Tooling (catches passives, connectors, etc.)
    'tooling': ['tooling', 'breadboard', 'jumper', 'wire', 'resistor', 'capacitor', 'diode', 'transistor', 'ic', 'connector', 'header', 'debug', 'switch', 'button']
}

# Headers from your iotkb_seed_v3_final.csv
CSV_HEADERS = [
    'part_label', 'part_type', 'part_kind', 'manufacturer', 'mpn', 
    'observed_property', 'actuatable_property', 'iface', 
    'vcc_min', 'vcc_max', 'offer_price', 'currency', 'product_url', 'notes',
    'feature_of_interest', 'i_active_mA', 'i_idle_uA', 'i2c_addr_default', 
    'i2c_addr_range', 'spi_max_mhz', 'uart_baud', 'sample_rate_max_hz', 
    'latency_ms', 'accuracy_pct', 'range_min', 'range_max', 'units', 
    'datasheet_url', 'lifecycle', 'Unnamed: 29', 'Unnamed: 30', 'Unnamed: 31'
]
# --- END CONFIGURATION ---

def to_snake_case(s):
    """Converts a string to lowercase snake_case."""
    if not s: return ''
    s = s.lower().strip()
    s = re.sub(r'[^a-z0-9\s_]', '', s) # Allow underscore
    s = re.sub(r'[\s-]+', '_', s) # Replace space or dash with underscore
    return s

def get_part_type_and_kind(tags):
    """Maps a list of Fritzing tags to our (part_type, part_kind) tuple."""
    tags_lower = [t.lower() for t in tags]
    
    for part_type, keywords in TAG_TO_PART_TYPE_MAP.items():
        for keyword in keywords:
            # Check for exact tag match
            if keyword in tags_lower:
                return part_type, to_snake_case(keyword)
            
            # Check for keyword within a tag
            for tag in tags_lower:
                if keyword in tag:
                    # Use the more specific tag as the 'kind'
                    return part_type, to_snake_case(tag)
                    
    return 'tooling', 'unknown' # Default for uncategorized components

def parse_fzp(fzp_content_string):
    """Parses the XML content of a .fzp file and returns a data dictionary."""
    try:
        root = ET.fromstring(fzp_content_string)
        
        title_elem = root.find('title')
        author_elem = root.find('author')
        desc_elem = root.find('description')
        url_elem = root.find('url')
        tags_elem = root.find('tags')
        
        part_label = title_elem.text if (title_elem is not None and title_elem.text) else 'Unknown Part'
        manufacturer = author_elem.text if (author_elem is not None and author_elem.text) else ''
        notes = desc_elem.text.strip() if (desc_elem is not None and desc_elem.text) else ''
        product_url = url_elem.text if (url_elem is not None and url_elem.text) else ''
        
        tags = []
        if tags_elem is not None:
            tags = [tag.text for tag in tags_elem.findall('tag') if tag.text is not None]
            
        part_type, part_kind = get_part_type_and_kind(tags)

        # Initialize all CSV row fields to empty
        row = {h: '' for h in CSV_HEADERS}
        row.update({
            'part_label': part_label,
            'part_type': part_type,
            'part_kind': part_kind,
            'manufacturer': manufacturer,
            'product_url': product_url,
            'notes': notes
        })
        return row

    except ET.ParseError:
        print(f"Warning: Skipping malformed XML file.", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Warning: Error parsing XML content: {e}", file=sys.stderr)
        return None

def main():
    # --- 1. Download the Fritzing parts repo ZIP ---
    print(f"Downloading Fritzing parts library from {REPO_ZIP_URL}...")
    try:
        response = requests.get(REPO_ZIP_URL, timeout=300)
        response.raise_for_status() # Raise an error for bad responses
        print("Download successful. Parsing ZIP file...")
    except requests.exceptions.RequestException as e:
        print(f"\n--- ERROR ---")
        print(f"Error downloading repository: {e}")
        print("Please check your internet connection and ensure 'requests' is installed (`pip install requests`)")
        sys.exit(1)

    # --- 2. Process the ZIP file in memory ---
    new_parts = []
    try:
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            # Find all .fzp files in the 'core' directory
            # The top-level folder in the zip is 'fritzing-parts-master'
            fzp_files = [f for f in z.namelist() if f.endswith('.fzp') and '/core/' in f]
            
            print(f"Found {len(fzp_files)} parts in the 'core' directory.")
            if not fzp_files:
                print("Error: No .fzp files found. Check the repository structure.", file=sys.stderr)
                sys.exit(1)

            # --- 3. Parse files ---
            for fzp_file in fzp_files:
                with z.open(fzp_file) as f:
                    content = f.read().decode('utf-8')
                    part_data = parse_fzp(content)
                    if part_data:
                        new_parts.append(part_data)
            
            print(f"Successfully parsed {len(new_parts)} parts.")

    except zipfile.BadZipFile:
        print("Error: Downloaded file is not a valid ZIP file.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error processing ZIP file: {e}", file=sys.stderr)
        sys.exit(1)

    # --- 4. Write to CSV ---
    if not new_parts:
        print("No parts were parsed. Exiting.", file=sys.stderr)
        sys.exit(1)
        
    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    try:
        with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
            writer.writeheader()
            writer.writerows(new_parts)
        print(f"\n--- SUCCESS ---")
        print(f"Successfully wrote {len(new_parts)} parts to {OUTPUT_CSV}")
        
    except Exception as e:
        print(f"Error writing to CSV file: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
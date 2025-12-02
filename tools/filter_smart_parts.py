import pandas as pd
import os

INPUT_FILE = 'data-entry/iotkb_refined.csv'
OUTPUT_FILE = 'data-entry/iotkb_smart_only.csv'

# Categories we WANT to keep for a Smart System DB
KEEP_CATEGORIES = ['sensor', 'actuator', 'controller', 'power']

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        return

    print(f"Reading {INPUT_FILE}...")
    df = pd.read_csv(INPUT_FILE)
    
    initial_count = len(df)
    
    # 1. Filter by Category
    # We drop 'tooling' and 'mechanical' unless they are specifically interesting
    df_smart = df[df['category'].isin(KEEP_CATEGORIES)]
    
    # 2. Filter out "Generic" noise if needed (Optional)
    # This removes rows where 'kind' is generic like 'component' or 'nan'
    df_smart = df_smart[~df_smart['kind'].isin(['component', 'nan', 'unknown'])]
    
    final_count = len(df_smart)
    
    print(f"Filtered out {initial_count - final_count} non-smart parts.")
    print(f"Remaining Smart System Parts: {final_count}")
    
    df_smart.to_csv(OUTPUT_FILE, index=False)
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
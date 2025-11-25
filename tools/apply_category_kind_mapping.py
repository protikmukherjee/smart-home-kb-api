# tools/apply_category_kind_mapping.py
import csv, sys, pathlib, shutil

# Allowed categories
ALLOWED = {"sensor","actuator","controller","power","mechanical","tooling"}

# Exact mapping by part_label → (category, kind)
MAP = {
    "Infrared Flame Sensor Module":                      ("sensor",     "flame"),
    "Gas Sensor Module":                                 ("sensor",     "gas_smoke"),
    "Passive Buzzer 3.3–5V":                             ("actuator",   "buzzer"),
    "ELEGOO ESP-WROOM-32 (Bluetooth)":                   ("controller", "esp32"),
    "ENS160 eCO2/TVOC + AHT21 Temp/Humidity":            ("sensor",     "environment_multi"),
    "Arduino Mega 2560":                                 ("controller", "arduino_mega"),
    "Ultrasonic Sensor HC-SR04":                         ("sensor",     "distance"),
    "DC Motor with Gearbox (High Torque)":               ("actuator",   "motor_dc"),
    "Dual H-Bridge Motor Driver (L298N)":                ("actuator",   "motor_driver"),
    "12V DC Adapter":                                    ("power",      "dc_12v_adapter"),
    "5V DC Adapter":                                     ("power",      "dc_5v_adapter"),
    "Relay Module (4-Channel)":                          ("actuator",   "relay_module"),
    "Reed Switch (Door State)":                          ("sensor",     "contact"),
    "Limit Switch (Endstop)":                            ("sensor",     "contact"),
    "RTC Module (DS3231)":                               ("controller", "rtc_module"),
    "Flexible Plastic Sheet (Door Panel)":               ("mechanical", "door_panel"),
    "LDR Module (Photoresistor)":                        ("sensor",     "light"),
    "PIR Motion Sensor HC-SR501":                        ("sensor",     "motion"),
    "Jumper Wires Kit (120pcs)":                         ("tooling",    "jumper_wires"),
    "INA226 Current/Power Monitor":                      ("sensor",     "current"),
    "Micro Submersible Water Pump":                      ("actuator",   "pump"),
    "Assorted LEDs Kit":                                 ("tooling",    "led_kit"),
    "Resistor Assortment Kit":                           ("tooling",    "resistor_kit"),
    "Breadboard":                                        ("tooling",    "breadboard"),
    "Soldering Kit":                                     ("tooling",    "soldering_kit"),
}

def main(inp, outp):
    inp_path = pathlib.Path(inp)
    out_path = pathlib.Path(outp)

    # backup the input once
    bak = inp_path.with_suffix(inp_path.suffix + ".bak")
    if not bak.exists():
        shutil.copyfile(inp_path, bak)

    with open(inp_path, newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        fieldnames = rdr.fieldnames
        if not fieldnames:
            raise SystemExit("CSV has no header")
        if "part_label" not in fieldnames or "category" not in fieldnames or "kind" not in fieldnames:
            raise SystemExit("CSV must have columns: part_label, category, kind")
        rows = list(rdr)

    updated, missing = 0, []
    for r in rows:
        label = (r.get("part_label") or "").strip()
        if not label:
            continue
        if label in MAP:
            cat, kind = MAP[label]
            if cat not in ALLOWED:
                raise SystemExit(f"Mapped category not allowed for {label}: {cat}")
            r["category"] = cat
            r["kind"] = kind
            updated += 1
        else:
            # leave untouched, but remember unmapped labels for info
            missing.append(label)

    # write out, preserving original column order
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    print(f"Updated rows: {updated}")
    # comment out if the list is noisy
    if missing:
        print(f"Unmapped rows left unchanged: {len(missing)}")

if __name__ == "__main__":
    if len(sys.argv) == 2:
        # in-place update
        main(sys.argv[1], sys.argv[1])
    elif len(sys.argv) == 3:
        main(sys.argv[1], sys.argv[2])
    else:
        print("Usage:")
        print("  python3 tools/apply_category_kind_mapping.py data-entry/iotkb_seed.csv")
        print("  python3 tools/apply_category_kind_mapping.py data-entry/iotkb_seed.csv data-entry/iotkb_seed_clean.csv")
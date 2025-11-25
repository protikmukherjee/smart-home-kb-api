#!/usr/bin/env python3
# usage:
#   python3 tools/merge_fritzing.py \
#       --seed /path/to/iotkb_seed.csv \
#       --fritzing /path/to/fritzing_import.csv \
#       --out /path/to/iotkb_seed_merged.csv

import argparse, re
import pandas as pd
from typing import Optional

def s(x: Optional[str]) -> str:
    if pd.isna(x): return ""
    return str(x).strip()

def infer_category(name: str, tags: str, family: str, props: str) -> str:
    text = " ".join([s(name), s(tags), s(family), s(props)]).lower()
    # sensors
    if any(k in text for k in ["sensor", "pir", "ultrasonic", "ldr", "rtc", "temperature", "humidity", "co2", "tvoc", "mq-"]):
        return "Sensor"
    # actuators
    if any(k in text for k in ["motor", "servo", "stepper", "relay", "buzzer", "solenoid", "pump"]):
        return "Actuator"
    # controllers
    if any(k in text for k in ["arduino", "esp32", "esp8266", "microcontroller", "stm32", "nano", "mega", "uno", "mcu", "dev board", "development board"]):
        return "Controller"
    # power
    if any(k in text for k in ["power supply", "adapter", "battery", "psu", "buck", "boost", "charger", "dc-dc"]):
        return "PowerSupply"
    # mechanical
    if any(k in text for k in ["gear", "shaft", "hinge", "bracket", "pulley", "bearing", "panel", "enclosure", "chassis", "screw"]):
        return "Mechanical"
    # tooling and misc
    if any(k in text for k in ["solder", "breadboard", "wire", "jumper", "kit", "glue", "tape", "heatshrink", "crimp", "tool", "resistor", "capacitor", "led"]):
        return "Tool"
    return "Tool"

def infer_kind(name: str, tags: str) -> str:
    t = (s(name) + " " + s(tags)).lower()
    # “kind” is a lightweight hint for downstream filters; keep it coarse
    if "pir" in t or "ultrasonic" in t or "hc-sr04" in t or "ldr" in t or "photoresistor" in t or "mq-" in t \
       or "gas" in t or "temperature" in t or "humidity" in t or "reed" in t or "limit switch" in t:
        return "sensor"
    if "relay" in t or "servo" in t or "stepper" in t or "dc motor" in t or "buzzer" in t or "pump" in t:
        return "actuator"
    if any(k in t for k in ["arduino", "esp32", "esp8266", "stm32", "microcontroller", "dev board", "uno", "nano", "mega"]):
        return "controller"
    if any(k in t for k in ["adapter", "battery", "buck", "boost", "psu", "dc-dc"]):
        return "power"
    if "breadboard" in t or "wire" in t or "jumper" in t or "solder" in t:
        return "helper"
    return ""

def infer_iface(text: str) -> str:
    t = s(text).lower()
    tokens = []
    if "i2c" in t: tokens.append("I2C")
    if "spi" in t: tokens.append("SPI")
    if "uart" in t or "serial" in t: tokens.append("UART")
    if "analog" in t or "adc" in t: tokens.append("ADC")
    if "gpio" in t or "digital" in t: tokens.append("GPIO")
    if "trigger" in t and "echo" in t: tokens.append("GPIO_TRIGGER_ECHO")
    return "|".join(sorted(set(tokens)))

def parse_voltage(text: str):
    t = s(text)
    m = re.findall(r"(\d+(?:\.\d+)?)\s*V", t, re.I)
    if not m:
        return "", ""
    vals = sorted([float(x) for x in m])
    if len(vals)==1:
        return str(vals[0]), str(vals[0])
    return str(vals[0]), str(vals[-1])

def norm_key(row):
    pl = s(row.get("part_label","")).lower()
    pl = re.sub(r"[^a-z0-9]+", "", pl)
    mm = s(row.get("manufacturer","")).lower() + "|" + s(row.get("mpn","")).lower()
    return (pl, mm)

def guess_col(df, candidates, default=None):
    for c in df.columns:
        cl = c.lower()
        for pat in candidates:
            if pat in cl:
                return c
    return default

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", required=True)
    ap.add_argument("--fritzing", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    seed = pd.read_csv(args.seed)
    seed_cols = list(seed.columns)
    fritz = pd.read_csv(args.fritzing)

    # Guess Fritzing columns (robust to different dumps)
    name_col = guess_col(fritz, ["title","name","label","displayname","part"], fritz.columns[0])
    manu_col = guess_col(fritz, ["manuf","vendor","brand"])
    mpn_col  = guess_col(fritz, ["mpn","sku","partnumber","p/n","pn","part no"])
    tags_col = guess_col(fritz, ["tag"])
    fam_col  = guess_col(fritz, ["family"])
    desc_col = guess_col(fritz, ["propert","description","details","notes"])
    url_col  = guess_col(fritz, ["url","link","product","store"])
    data_col = guess_col(fritz, ["datasheet","spec"])
    volt_col = guess_col(fritz, ["volt","supply","vcc","power"])
    iface_col= guess_col(fritz, ["iface","interface","io","pins"])

    # Normalize Fritzing rows into seed schema
    out_rows = []
    for _, r in fritz.iterrows():
        name = s(r.get(name_col, ""))
        manu = s(r.get(manu_col, "")) if manu_col else ""
        mpn  = s(r.get(mpn_col, "")) if mpn_col else ""
        tags = s(r.get(tags_col, "")) if tags_col else ""
        fam  = s(r.get(fam_col, "")) if fam_col else ""
        desc = s(r.get(desc_col, "")) if desc_col else ""
        url  = s(r.get(url_col, "")) if url_col else ""
        durl = s(r.get(data_col, "")) if data_col else ""
        vtxt = " ".join([s(r.get(volt_col,"")), desc, tags, fam, name])
        vmin, vmax = parse_voltage(vtxt)
        iface_guess = infer_iface(" ".join([s(r.get(iface_col,"")), tags, desc]))
        category = infer_category(name, tags, fam, desc)
        kind = infer_kind(name, tags)

        rec = {col: "" for col in seed_cols}
        rec.update({
            "manufacturer": manu,
            "mpn": mpn,
            "part_label": name if name else (mpn or "Fritzing Part"),
            "category": category,
            "kind": kind,
            "observed_property": "",
            "actuatable_property": "",
            "feature_of_interest": "",
            "vcc_min": vmin,
            "vcc_max": vmax,
            "i_active_mA": "",
            "i_idle_uA": "",
            "iface": iface_guess,
            "i2c_addr_default": "",
            "i2c_addr_range": "",
            "spi_max_mhz": "",
            "uart_baud": "",
            "sample_rate_max_hz": "",
            "latency_ms": "",
            "accuracy_pct": "",
            "range_min": "",
            "range_max": "",
            "units": "",
            "datasheet_url": durl,
            "product_url": url,
            "offer_price": "",
            "currency": "",
            "lifecycle": "",
            "notes": "imported_from_fritzing"
        })
        out_rows.append(rec)

    fritz_norm = pd.DataFrame(out_rows)
    # enforce exact seed column order
    fritz_norm = fritz_norm[seed_cols]

    merged = pd.concat([seed, fritz_norm], ignore_index=True)
    merged["_k"] = merged.apply(norm_key, axis=1)
    merged["_is_seed"] = False
    merged.loc[:len(seed)-1, "_is_seed"] = True
    merged = merged.sort_values(by=["_k","_is_seed"], ascending=[True, False])
    merged = merged.drop_duplicates(subset=["_k"], keep="first").drop(columns=["_k","_is_seed"])

    merged.to_csv(args.out, index=False)

    # Simple stats
    print("OK")
    print("seed_rows:", len(seed))
    print("fritzing_rows:", len(fritz))
    print("merged_rows:", len(merged))
    print("new_rows_added:", len(merged)-len(seed))
    print("output:", args.out)

if __name__ == "__main__":
    main()
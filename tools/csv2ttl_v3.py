import sys, csv, re
from typing import Optional, List

BASE = "https://example.org/iotkb"
EX = BASE + "#"

def iri_local(s: str) -> str:
    s = (s or "").strip()
    # Replace non-alphanumeric chars with underscore, then strip leading/trailing underscores
    s = re.sub(r"[^A-Za-z0-9]+", "_", s)
    s = s.strip("_")
    return s or "unnamed"

def decfrag(val: Optional[str]) -> Optional[str]:
    v = (val or "").strip()
    if not v or v.lower() == 'nan':
        return None
    try:
        float(v)
        return v
    except Exception:
        return None

def intfrag(val: Optional[str]) -> Optional[str]:
    v = (val or "").strip()
    if not v or v.lower() == 'nan':
        return None
    try:
        return str(int(float(v))) # Handle "4.0" as "4"
    except Exception:
        return None

def tokens(val: Optional[str], seps=(",", "|")) -> List[str]:
    if not val or str(val).lower() == 'nan':
        return []
    t = [str(val)]
    for sep in seps:
        t = sum((x.split(sep) for x in t), [])
    return [x.strip() for x in t if x.strip()]

def esc_lit(v: str) -> str:
    v = str(v).replace("\\", "\\\\").replace('"', '\\"').replace('\n', ' ')
    if v.lower() == 'nan': return ""
    return v

# --- MAPPING ---
CLASS_BY_PART_TYPE = {
    "sensor": "SensorPart",
    "actuator": "ActuatorPart",
    "controller": "ControllerBoard",
    "power": "PowerSupply",
    "mechanical": "Mechanical",
    "tooling": "Tooling"
}

HEADER = f"""@prefix ex:   <{EX}> .
@prefix sosa: <http://www.w3.org/ns/sosa/> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<{BASE}/parts> a owl:Ontology ;
  rdfs:label "IoT Knowledge Base Parts" ;
  owl:imports <{BASE}> .
"""

def main(csv_in, ttl_out):
    try:
        with open(csv_in, newline='', encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
    except FileNotFoundError:
        print(f"Error: Input file not found at {csv_in}")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        sys.exit(1)

    # Collect distinct object properties to declare them
    obs_props, act_props, ifaces, features = set(), set(), set(), set()
    for r in rows:
        for p in tokens(r.get("observed_property","")): obs_props.add(p)
        for p in tokens(r.get("actuatable_property","")): act_props.add(p)
        for i in tokens(r.get("iface","")): ifaces.add(i)
        for f in tokens(r.get("feature_of_interest","")): features.add(f)

    out = [HEADER]

    # Declare Individuals for properties/interfaces
    for p in sorted(obs_props):
        out.append(f"ex:{iri_local(p)} a sosa:ObservableProperty .")
    for p in sorted(act_props):
        out.append(f"ex:{iri_local(p)} a sosa:ActuatableProperty .")
    for i in sorted(ifaces):
        out.append(f"ex:{iri_local(i)} a ex:Interface .")
    for f in sorted(features):
        out.append(f"ex:{iri_local(f)} a sosa:FeatureOfInterest .")
    
    if obs_props or act_props or ifaces or features:
        out.append("")

    for r in rows:
        label_raw = r.get("part_label") or (r.get("manufacturer","") + " " + r.get("mpn","")).strip()
        if not label_raw: continue
        
        local = iri_local(label_raw)
        
        part_type = (r.get("category","") or r.get("part_type","")).strip().lower()
        cls = CLASS_BY_PART_TYPE.get(part_type) or "Part"

        block = [f"ex:{local} a ex:{cls} ;"]
        
        # --- Helper Functions ---
        def put_dec(prop, key):
            v = decfrag(r.get(key))
            if v is not None:
                block.append(f"  {prop} \"{v}\"^^xsd:decimal ;")
        def put_int(prop, key):
            v = intfrag(r.get(key))
            if v is not None:
                block.append(f"  {prop} \"{v}\"^^xsd:integer ;")
        def put_str(prop, key):
            raw = (r.get(key) or "").strip()
            if raw and raw.lower() != 'nan':
                block.append(f"  {prop} \"{esc_lit(raw)}\" ;")
        def put_uri(prop, key):
            raw = (r.get(key) or "").strip()
            if raw and raw.lower() != 'nan':
                # Simple check to ensure it looks like a URI
                if raw.startswith("http"):
                    block.append(f"  {prop} \"{esc_lit(raw)}\"^^xsd:anyURI ;")
                else:
                    block.append(f"  {prop} \"{esc_lit(raw)}\" ;")

        # --- Map All Columns ---
        put_str("rdfs:label", "part_label")
        
        # Identity
        put_str("ex:partKind", "kind") # or 'part_kind'
        put_str("ex:manufacturer", "manufacturer")
        put_str("ex:mpn", "mpn")
        
        # Semantics
        for p in tokens(r.get("observed_property","")):
            block.append(f"  sosa:observesProperty ex:{iri_local(p)} ;") # Changed to proper sosa: prop
        for p in tokens(r.get("actuatable_property","")):
            block.append(f"  sosa:actsOnProperty   ex:{iri_local(p)} ;") # Changed to proper sosa: prop
        for f in tokens(r.get("feature_of_interest","")):
            block.append(f"  sosa:hasFeatureOfInterest ex:{iri_local(f)} ;") # Changed to proper sosa: prop
        for i in tokens(r.get("iface","")):
            block.append(f"  ex:hasInterface     ex:{iri_local(i)} ;")
        
        # Electrical
        put_dec("ex:vccMin", "vcc_min")
        put_dec("ex:vccMax", "vcc_max")
        put_dec("ex:logicLevel", "logic_level")
        put_dec("ex:iActive_mA", "i_active_mA")
        put_dec("ex:iIdle_uA", "i_idle_uA")
        
        # Physical
        put_str("ex:packageCase", "package_case")
        put_int("ex:pinCount", "pin_count")
        put_dec("ex:tempMinC", "temp_min_c")
        put_dec("ex:tempMaxC", "temp_max_c")

        # Interface Details
        put_str("ex:i2cAddrDefault", "i2c_addr_default")
        put_str("ex:i2cAddrRange", "i2c_addr_range")
        put_dec("ex:spiMaxFreq_MHz", "spi_max_mhz")
        put_str("ex:uartBaud", "uart_baud")
        
        # Performance
        put_dec("ex:sampleRateMax_Hz", "sample_rate_max_hz")
        put_dec("ex:latency_ms", "latency_ms")
        put_dec("ex:accuracy_pct", "accuracy_pct")
        put_dec("ex:rangeMin", "range_min")
        put_dec("ex:rangeMax", "range_max")
        put_str("ex:units", "units")
        
        # Metadata
        put_uri("ex:datasheetURL", "datasheet_url")
        put_uri("ex:productURL", "product_url")
        put_dec("ex:offerPrice", "offer_price")
        put_str("ex:priceCurrency", "currency")
        put_str("ex:lifecycle", "lifecycle")
        put_str("ex:notes", "notes")

        if block[-1].endswith(" ;"):
            block[-1] = block[-1][:-2] + " ."
        else:
            block.append(".")

        out.extend(block)
        out.append("")

    with open(ttl_out, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"Success: Generated TTL with {len(rows)} parts to {ttl_out}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 tools/csv2ttl_v3.py <input_csv_path> <output_ttl_path>")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
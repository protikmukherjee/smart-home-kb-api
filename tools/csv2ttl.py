# filename: tools/csv2ttl.py
# usage:    python3 tools/csv2ttl.py data-entry/iotkb_seed.csv ontologies/iotkb_parts.ttl
import sys, csv, re
from typing import Optional, List

BASE = "https://example.org/iotkb"
EX   = BASE + "#"

# ---------- helpers -----------------------------------------------------------

def iri_local(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"[^A-Za-z0-9]+", "_", s)
    s = s.strip("_")
    return s or "unnamed"

def decfrag(val: Optional[str]) -> Optional[str]:
    v = (val or "").strip()
    if not v:
        return None
    try:
        float(v)
        return v
    except Exception:
        return None

def tokens(val: Optional[str], seps=(",", "|")) -> List[str]:
    if not val:
        return []
    t = [val]
    for sep in seps:
        t = sum((x.split(sep) for x in t), [])
    return [x.strip() for x in t if x.strip()]

def esc_lit(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"')

# ---------- canonicalization --------------------------------------------------

def norm_category(raw: str) -> str:
    """Normalize free-text to one of: sensor, actuator, controller, power, mechanical, tooling."""
    key = (raw or "").strip().lower()
    key = key.replace(" ", "").replace("-", "").replace("_", "")
    CANON = {
        "sensor":"sensor","sensors":"sensor","sensormodule":"sensor",
        "actuator":"actuator","actuators":"actuator","driver":"actuator",
        "relay":"actuator","relaymodule":"actuator","motordriver":"actuator",
        "controller":"controller","controllerboard":"controller",
        "controllerboards":"controller","microcontroller":"controller","board":"controller",
        "power":"power","powersupply":"power","powersupplies":"power",
        "powersupplyunit":"power","psu":"power","adapter":"power","dcadapter":"power",
        "mechanical":"mechanical","mechanics":"mechanical",
        "tooling":"tooling","tool":"tooling","tools":"tooling",
        "kit":"tooling","kits":"tooling","accessory":"tooling","accessories":"tooling",
        "helper":"tooling","breadboard":"tooling","wiring":"tooling","jumperwires":"tooling",
    }
    return CANON.get(key, (raw or "").strip().lower())

CLASS_BY_CATEGORY = {
    "sensor":"SensorPart",
    "actuator":"ActuatorPart",
    "controller":"ControllerBoard",
    "power":"PowerSupply",
    "mechanical":"Mechanical",
    "tooling":"Part",
}

# Fallback interfaces for controller boards when CSV 'iface' is empty
DEFAULT_CTRL_IFACES = ["I2C", "SPI", "UART", "ADC", "GPIO"]

# ---------- header ------------------------------------------------------------

HEADER = f"""@prefix ex:   <{EX}> .
@prefix sosa: <http://www.w3.org/ns/sosa/> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<{BASE}/parts> a owl:Ontology ;
  owl:imports <{BASE}> .
"""

# ---------- main --------------------------------------------------------------

def main(csv_in, ttl_out):
    with open(csv_in, newline='', encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    # collect vocab we must predeclare
    obs_props, act_props, ifaces = set(), set(), set()
    for r in rows:
        for p in tokens(r.get("observed_property","")):   obs_props.add(p)
        for p in tokens(r.get("actuatable_property","")): act_props.add(p)
        for i in tokens(r.get("iface","")):               ifaces.add(i)

    # ensure fallback controller interfaces exist as individuals even if not in CSV
    for i in DEFAULT_CTRL_IFACES:
        ifaces.add(i)

    out = [HEADER]

    # declare properties and interfaces (with labels)
    for p in sorted(x for x in obs_props if x):
        plocal = iri_local(p)
        out.append(f'ex:{plocal} a sosa:ObservableProperty ; rdfs:label "{esc_lit(p)}" .')
    for p in sorted(x for x in act_props if x):
        plocal = iri_local(p)
        out.append(f'ex:{plocal} a sosa:ActuatableProperty ; rdfs:label "{esc_lit(p)}" .')
    for i in sorted(x for x in ifaces if x):
        ilocal = iri_local(i)
        out.append(f'ex:{ilocal} a ex:Interface ; rdfs:label "{esc_lit(i)}" .')
    if obs_props or act_props or ifaces:
        out.append("")

    # emit each part
    for r in rows:
        label = r.get("part_label") or (r.get("manufacturer","") + " " + r.get("mpn","")).strip() or "Part"
        local = iri_local(label)

        cat_lc  = norm_category(r.get("category",""))
        kind_lc = (r.get("kind","") or "").strip().lower()
        cls     = CLASS_BY_CATEGORY.get(cat_lc, "Part")
        is_controller = (cls == "ControllerBoard")

        block = [f"ex:{local} a ex:{cls} ;",
                 f'  rdfs:label "{esc_lit(label)}" ;']

        # object properties
        for p in tokens(r.get("observed_property","")):
            block.append(f"  ex:observesProperty ex:{iri_local(p)} ;")
        for p in tokens(r.get("actuatable_property","")):
            block.append(f"  ex:actsOnProperty   ex:{iri_local(p)} ;")

        iface_tokens = tokens(r.get("iface",""))
        if is_controller and not iface_tokens:
            iface_tokens = DEFAULT_CTRL_IFACES  # auto-fallback

        for i in iface_tokens:
            if is_controller:
                block.append(f"  ex:supportsInterface ex:{iri_local(i)} ;")
            else:
                block.append(f"  ex:hasInterface     ex:{iri_local(i)} ;")

        # data helpers
        def put_dec(prop, key):
            v = decfrag(r.get(key))
            if v is not None:
                block.append(f'  {prop} "{v}"^^xsd:decimal ;')
        def put_str(prop, key, lower=False):
            raw = (r.get(key) or "").strip()
            if not raw:
                return
            if lower:
                raw = raw.lower()
            block.append(f'  {prop} "{esc_lit(raw)}" ;')
        def put_uri(prop, key):
            raw = (r.get(key) or "").strip()
            if raw:
                block.append(f'  {prop} "{esc_lit(raw)}"^^xsd:anyURI ;')

        # taxonomy annotations
        if cat_lc:
            block.append(f'  ex:category "{esc_lit(cat_lc)}" ;')
        if kind_lc:
            block.append(f'  ex:kind "{esc_lit(kind_lc)}" ;')

        # numeric + string specs
        put_str("ex:manufacturer", "manufacturer")
        put_str("ex:mpn",          "mpn")
        put_dec("ex:vccMin",       "vcc_min")
        put_dec("ex:vccMax",       "vcc_max")
        put_dec("ex:iActive_mA",   "i_active_mA")
        put_dec("ex:iIdle_uA",     "i_idle_uA")
        put_dec("ex:sampleRateMax_Hz","sample_rate_max_hz")
        put_dec("ex:latency_ms",   "latency_ms")
        put_dec("ex:accuracy_pct", "accuracy_pct")
        put_dec("ex:rangeMin",     "range_min")
        put_dec("ex:rangeMax",     "range_max")
        put_str("ex:units",        "units")
        put_str("ex:i2cAddrDefault","i2c_addr_default")
        put_str("ex:i2cAddrRange", "i2c_addr_range")
        put_dec("ex:spiMaxFreq_MHz","spi_max_mhz")
        put_str("ex:uartBaud",     "uart_baud")
        put_uri("ex:datasheetURL", "datasheet_url")
        put_uri("ex:productURL",   "product_url")
        put_dec("ex:offerPrice",   "offer_price")
        put_str("ex:priceCurrency","currency")
        put_str("ex:lifecycle",    "lifecycle")
        put_str("ex:notes",        "notes")

        # close block
        if block[-1].endswith(" ;"):
            block[-1] = block[-1][:-2] + " ."
        else:
            block.append(".")

        out.extend(block)
        out.append("")

    with open(ttl_out, "w", encoding="utf-8") as f:
        f.write("\n".join(out))

# ---------- entrypoint --------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 tools/csv2ttl.py data-entry/iotkb_seed.csv ontologies/iotkb_parts.ttl")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
# filename: tools/recommend.py
# usage examples:
#   python3 tools/recommend.py --kb ontologies/iotkb_parts.ttl --cls SensorPart --need distance --iface GPIO_TRIGGER_ECHO --v 5.0 --budget 30
#   python3 tools/recommend.py --kb ontologies/iotkb_parts.ttl --cls SensorPart --need motion --controller ELEGOO_ESP_WROOM_32_Bluetooth --v 5.0
import argparse
from rdflib import Graph, Namespace, URIRef, Literal
from rdflib.namespace import RDF, XSD

EX   = Namespace("https://example.org/iotkb#")
SOSA = Namespace("http://www.w3.org/ns/sosa/")

def local(name: str) -> URIRef:
    return EX[name]

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--kb", required=True, help="TTL file with parts")
    p.add_argument("--cls", default="SensorPart", help="ex: class local name (SensorPart, ActuatorPart, etc.)")
    p.add_argument("--need", help="capability (distance, motion, power_state, etc.)")
    p.add_argument("--iface", help="required interface token (GPIO, I2C, SPI, GPIO_TRIGGER_ECHO, ...)")
    p.add_argument("--controller", help="controller local name to derive interfaces from supportsInterface")
    p.add_argument("--v", type=float, help="supply voltage to check against vccMin/vccMax")
    p.add_argument("--budget", type=float, help="max price to include (offerPrice <= budget)")
    return p.parse_args()

def get_controller_ifaces(g: Graph, ctrl_local: str):
    q = """
    PREFIX ex:<https://example.org/iotkb#>
    SELECT ?lbl WHERE {
      ex:CTRL ex:supportsInterface ?i .
      OPTIONAL { ?i <http://www.w3.org/2000/01/rdf-schema#label> ?lbl }
      BIND (IF(BOUND(?lbl), ?lbl, STRAFTER(STR(?i), "#")) AS ?lbl)
    }
    """
    q = q.replace("ex:CTRL", f"ex:{ctrl_local}")
    res = g.query(q)
    toks = []
    for row in res:
        tok = str(row[0]).strip()
        if tok:
            toks.append(tok)
    return sorted(set(toks))

def decimal_val(g: Graph, s: URIRef, p: URIRef):
    for o in g.objects(s, p):
        try:
            if isinstance(o, Literal) and (o.datatype == XSD.decimal or o.datatype == XSD.double or o.datatype == XSD.float or o.datatype == XSD.integer):
                return float(o)
            # also accept plain literal with numeric string
            return float(str(o))
        except Exception:
            continue
    return None

def string_vals(g: Graph, s: URIRef, p: URIRef):
    return [str(o) for o in g.objects(s, p)]

def label_of(g: Graph, s: URIRef):
    for o in g.objects(s, Namespace("http://www.w3.org/2000/01/rdf-schema#").label):
        return str(o)
    # fallback to local fragment
    iri = str(s)
    return iri.split("#")[-1]

def main():
    args = parse_args()
    g = Graph()
    g.parse(args.kb, format="turtle")

    cls = local(args.cls)

    # derive interface constraints
    iface_required = set()
    if args.controller:
        iface_tokens = get_controller_ifaces(g, args.controller)
        iface_required.update(iface_tokens)
    if args.iface:
        iface_required.add(args.iface)

    # determine capability property based on class
    cap_pred = None
    if args.need:
        if args.cls.lower() == "sensorpart":
            cap_pred = EX.observesProperty
            cap_ind  = local(args.need)
        elif args.cls.lower() == "actuatorpart":
            cap_pred = EX.actsOnProperty
            cap_ind  = local(args.need)
        else:
            # for non-sensor/actuator classes, ignore capability filter
            cap_pred = None
            cap_ind  = None
    else:
        cap_ind = None

    # collect candidates of requested class
    candidates = []
    for s in g.subjects(RDF.type, cls):
        candidates.append(s)

    # filter by capability
    if cap_pred and cap_ind:
        candidates = [s for s in candidates if (s, cap_pred, cap_ind) in g]

    # filter by interface (hasInterface for parts; supportsInterface handled only on controller individuals)
    if iface_required:
        keep = []
        for s in candidates:
            part_ifaces = [label_of(g, i).strip() for i in g.objects(s, EX.hasInterface)]
            if not part_ifaces:
                # some rows might have no interface listed → skip if a constraint exists
                continue
            if any(tok in part_ifaces for tok in iface_required):
                keep.append(s)
        candidates = keep

    # filter by voltage
    if args.v is not None:
        keep = []
        for s in candidates:
            vmin = decimal_val(g, s, EX.vccMin)
            vmax = decimal_val(g, s, EX.vccMax)
            ok = True
            if vmin is not None and args.v < vmin: ok = False
            if vmax is not None and args.v > vmax: ok = False
            if ok: keep.append(s)
        candidates = keep

    # filter by budget
    if args.budget is not None:
        keep = []
        for s in candidates:
            price = decimal_val(g, s, EX.offerPrice)
            if price is None or price <= args.budget:
                keep.append(s)
        candidates = keep

    # pretty print
    if not candidates:
        print("No candidates found.")
        if args.controller:
            print("Debugging…")
            print(f"- Controller: {args.controller}")
            print(f"- Interfaces from controller: {sorted(iface_required)}")
            print(f"- Class: {args.cls}")
            # show some same-class parts and their ifaces to help adjust CSV
            sample = []
            for s in g.subjects(RDF.type, cls):
                lab = label_of(g, s)
                ifaces = [label_of(g, i) for i in g.objects(s, EX.hasInterface)]
                needs  = [label_of(g, p) for p in g.objects(s, EX.observesProperty)] + [label_of(g, p) for p in g.objects(s, EX.actsOnProperty)]
                vmin = decimal_val(g, s, EX.vccMin) or ""
                vmax = decimal_val(g, s, EX.vccMax) or ""
                sample.append((lab, ",".join(needs), ",".join(ifaces), str(vmin), str(vmax)))
            print("- Sample parts of the class and their (needs, ifaces, vccMin, vccMax):")
            for row in sample[:10]:
                print("   ", row)
        return

    # output table
    rows = []
    for s in candidates:
        lab   = label_of(g, s)
        price = decimal_val(g, s, EX.offerPrice)
        cur   = None
        for o in g.objects(s, EX.priceCurrency):
            cur = str(o); break
        vmin  = decimal_val(g, s, EX.vccMin)
        vmax  = decimal_val(g, s, EX.vccMax)
        url   = None
        for o in g.objects(s, EX.productURL):
            url = str(o); break
        rows.append((lab, price, cur or "", vmin, vmax, url or ""))

    # sort by price then label
    rows.sort(key=lambda r: (float(r[1]) if r[1] is not None else 1e12, r[0]))

    # print header and rows
    print(f"{'PART':<40} {'PRICE':>8} {'CUR':>3} {'V_MIN':>6} {'V_MAX':>6}  URL")
    print("-"*100)
    for lab, price, cur, vmin, vmax, url in rows:
        ps = f"{price:.2f}" if price is not None else "-"
        vmins = f"{vmin:.2f}" if vmin is not None else ""
        vmaxs = f"{vmax:.2f}" if vmax is not None else ""
        print(f"{lab:<40} {ps:>8} {cur:>3} {vmins:>6} {vmaxs:>6}  {url}")
if __name__ == "__main__":
    main()
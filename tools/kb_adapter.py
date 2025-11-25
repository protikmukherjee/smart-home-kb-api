# Tiny FastAPI wrapper around your KB to serve recommendations.
# Run: uvicorn tools.kb_adapter:app --reload
from fastapi import FastAPI
from pydantic import BaseModel
from rdflib import Graph, Namespace, URIRef, Literal
from rdflib.namespace import RDF, XSD

EX   = Namespace("https://example.org/iotkb#")
SOSA = Namespace("http://www.w3.org/ns/sosa/")
app  = FastAPI(title="IoT KB Adapter")

# Load KB once
G = Graph()
G.parse("ontologies/iotkb_schema.ttl", format="turtle")
G.parse("ontologies/iotkb_align.ttl",  format="turtle")
G.parse("ontologies/iotkb_parts.ttl",  format="turtle")

class Req(BaseModel):
    cls: str                     # "SensorPart" | "ActuatorPart" | "ControllerBoard" | "Part"
    properties: list[str] = []   # e.g. ["distance"], ["motion"], ["power_state"]
    interfaces: list[str] = []   # e.g. ["I2C"], ["GPIO_TRIGGER_ECHO"]
    v: float | None = None       # target rail, e.g. 5.0
    budget: float | None = None  # e.g. 30.0
    currency: str | None = None  # "CAD" optional

def iri_local(u: URIRef) -> str:
    s = str(u)
    return s.split("#")[-1] if "#" in s else s.rsplit("/",1)[-1]

@app.post("/recommend")
def recommend(req: Req):
    cls_iri  = EX[req.cls]
    prop_iris = [EX[p] for p in req.properties]
    iface_iris= [EX[i] for i in req.interfaces]

    # Build a basic SPARQL query with optional filters
    where = [f"?part a <{cls_iri}> ."]

    for p in prop_iris:
        where.append(f"?part <{EX.observesProperty}> <{p}> .")  # safe for sensors/parts. Actuators can pass empty

    for i in iface_iris:
        where.append(f"?part <{EX.hasInterface}> <{i}> .")

    where.append("OPTIONAL { ?part <"+str(EX.vccMin)+"> ?vmin }")
    where.append("OPTIONAL { ?part <"+str(EX.vccMax)+"> ?vmax }")
    where.append("OPTIONAL { ?part <"+str(EX.offerPrice)+"> ?price }")
    where.append("OPTIONAL { ?part <"+str(EX.priceCurrency)+"> ?cur }")

    if req.v is not None:
        where.append(f"FILTER( (!BOUND(?vmin) || xsd:decimal(?vmin) <= {req.v}) && (!BOUND(?vmax) || xsd:decimal(?vmax) >= {req.v}) )")

    if req.budget is not None:
        where.append(f"FILTER( !BOUND(?price) || xsd:decimal(?price) <= {req.budget} )")
    if req.currency:
        where.append(f'FILTER( !BOUND(?cur) || STR(?cur) = "{req.currency}" )')

    q = f"""
PREFIX ex:   <{EX}>
PREFIX xsd:  <{XSD}>
SELECT ?part ?vmin ?vmax ?price ?cur WHERE {{
  {' '.join(where)}
}}
"""
    res = []
    for row in G.query(q):
        part, vmin, vmax, price, cur = row
        res.append({
            "iri": str(part),
            "label": iri_local(part),
            "vcc_min": float(vmin) if vmin else None,
            "vcc_max": float(vmax) if vmax else None,
            "price": float(price) if price else None,
            "currency": str(cur) if cur else None
        })

    # simple ranking: iface match count desc, price asc, name asc
    def score(x):
        p = x["price"] if x["price"] is not None else 1e9
        return (p, x["label"])
    res.sort(key=score)
    return {"count": len(res), "items": res}
from flask import Flask, request, jsonify
from flask_cors import CORS
import rdflib
import sys

app = Flask(__name__)
CORS(app)  # Allow Zenan's web editor to call this

# Load the Knowledge Base once at startup
g = rdflib.Graph()
KB_PATH = "ontologies/iotkb_parts.ttl"
print(f"Loading Knowledge Base from {KB_PATH}...")
g.parse(KB_PATH, format="turtle")
print(f"Loaded {len(g)} triples.")

QUERY_TEMPLATE = """
PREFIX ex: <https://example.org/iotkb#>
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?part ?label ?manufacturer ?price ?currency ?img ?datasheet
WHERE {
  ?part a ?cls .
  ?part rdfs:label ?label .
  
  # Filter by Category (Class)
  FILTER(?cls = ex:%s)
  
  # Optional Filters (only applied if requested)
  %s
  
  OPTIONAL { ?part ex:manufacturer ?manufacturer . }
  OPTIONAL { ?part ex:offerPrice ?price . }
  OPTIONAL { ?part ex:priceCurrency ?currency . }
  OPTIONAL { ?part ex:productURL ?img . }
  OPTIONAL { ?part ex:datasheetURL ?datasheet . }
}
ORDER BY ?price
LIMIT 10
"""

CLASS_MAP = {
    "sensor": "SensorPart",
    "actuator": "ActuatorPart",
    "controller": "ControllerBoard",
    "power": "PowerSupply"
}

@app.route('/recommend', methods=['GET'])
def recommend():
    category = request.args.get('category', 'sensor').lower()
    property_filter = request.args.get('property') # e.g. "temperature"
    iface_filter = request.args.get('iface')       # e.g. "I2C"
    
    cls_name = CLASS_MAP.get(category, "Part")
    
    filters = ""
    if property_filter:
        # Regex search for observed or actuatable property
        filters += f"""
        {{
          {{ ?part sosa:observesProperty ?prop . }} UNION {{ ?part sosa:actsOnProperty ?prop . }}
          FILTER(REGEX(STR(?prop), "{property_filter}", "i"))
        }}
        """
    
    if iface_filter:
        filters += f"""
        ?part ex:hasInterface ?iface .
        FILTER(REGEX(STR(?iface), "{iface_filter}", "i"))
        """

    query = QUERY_TEMPLATE % (cls_name, filters)
    
    results = []
    try:
        qres = g.query(query)
        for row in qres:
            results.append({
                "iri": str(row.part),
                "name": str(row.label),
                "manufacturer": str(row.manufacturer) if row.manufacturer else "",
                "price": float(row.price) if row.price else 0.0,
                "currency": str(row.currency) if row.currency else "USD",
                "link": str(row.img) if row.img else "",
                "datasheet": str(row.datasheet) if row.datasheet else ""
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(results)

if __name__ == '__main__':
    app.run(port=5000, debug=True)
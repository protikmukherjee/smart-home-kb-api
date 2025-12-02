from flask import Flask, request, jsonify
from flask_cors import CORS
import rdflib
import os

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing so web apps can call this

# --- CONFIGURATION ---
KB_FILE = "ontologies/iotkb_parts.ttl"  # The file you just generated

# --- LOAD KNOWLEDGE BASE ---
print(f"Loading Knowledge Base from {KB_FILE}...")
if not os.path.exists(KB_FILE):
    print("Error: TTL file not found! Did you run csv2ttl_v3.py?")
    exit(1)

g = rdflib.Graph()
try:
    g.parse(KB_FILE, format="turtle")
    print(f"Loaded {len(g)} triples successfully.")
except Exception as e:
    print(f"Error parsing TTL file: {e}")
    exit(1)

# --- SPARQL QUERY TEMPLATE ---
# This query finds parts that match a category and (optionally) a capability
QUERY_TEMPLATE = """
PREFIX ex: <https://example.org/iotkb#>
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?part ?label ?price ?currency ?manufacturer ?img
WHERE {
  ?part a ?type .
  ?part rdfs:label ?label .
  
  # Filter by Category (Class)
  FILTER(?type = ex:%s)
  
  # Optional: Filter by Property (e.g. "temperature")
  %s
  
  # Optional fields to return
  OPTIONAL { ?part ex:offerPrice ?price . }
  OPTIONAL { ?part ex:priceCurrency ?currency . }
  OPTIONAL { ?part ex:manufacturer ?manufacturer . }
  OPTIONAL { ?part ex:productURL ?img . }
}
ORDER BY ?price
LIMIT 20
"""

# Map user-friendly category names to Ontology Classes
CLASS_MAP = {
    "sensor": "SensorPart",
    "actuator": "ActuatorPart",
    "controller": "ControllerBoard",
    "power": "PowerSupply",
    "mechanical": "Mechanical",
    "tooling": "Tooling"
}

@app.route('/recommend', methods=['GET'])
def recommend():
    """
    Endpoint: /recommend
    Params:
      - category: sensor, actuator, controller (default: sensor)
      - property: temperature, motion, light (optional)
    """
    category = request.args.get('category', 'sensor').lower()
    prop_filter = request.args.get('property', '').lower()
    
    # 1. Resolve Class Name
    cls_name = CLASS_MAP.get(category, "SensorPart")
    
    # 2. Build Property Filter (if provided)
    prop_query_part = ""
    if prop_filter:
        # This SPARQL fragment checks if the part observes OR acts on the property
        prop_query_part = f"""
        {{
          {{ ?part sosa:observesProperty ?obs . FILTER(REGEX(STR(?obs), "{prop_filter}", "i")) }}
          UNION
          {{ ?part sosa:actsOnProperty ?act . FILTER(REGEX(STR(?act), "{prop_filter}", "i")) }}
        }}
        """

    # 3. Construct Final Query
    final_query = QUERY_TEMPLATE % (cls_name, prop_query_part)
    
    # 4. Execute
    results = []
    try:
        qres = g.query(final_query)
        for row in qres:
            part_data = {
                "iri": str(row.part),
                "name": str(row.label),
                "manufacturer": str(row.manufacturer) if row.manufacturer else "Unknown",
                "price": float(row.price) if row.price else 0.0,
                "currency": str(row.currency) if row.currency else "USD",
                "image_url": str(row.img) if row.img else ""
            }
            results.append(part_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({
        "query": {"category": category, "property": prop_filter},
        "count": len(results),
        "results": results
    })

@app.route('/status', methods=['GET'])
def status():
    return jsonify({"status": "online", "triples": len(g)})

if __name__ == '__main__':
    print("Starting IoT Knowledge Base Server on port 5000...")
    app.run(host='0.0.0.0', port=5000)
# IoT Fault Detection Engine

A configuration-driven fault detection engine for IoT systems built on the ArchML framework. The engine monitors live telemetry from Firebase Realtime Database, detects anomalies across seven fault categories, and writes structured alerts back to RTDB — all without writing system-specific code.

## Motivation

IoT systems fail in predictable ways: sensors go silent, readings drift out of range, actuator states contradict each other, or values that are normal during the day become abnormal at night. Rather than writing bespoke monitoring logic for every new system, this engine captures those universal failure patterns in a single detection pipeline and lets you describe the system-specific details (thresholds, field names, coherence rules) in a JSON config file.

The result is that onboarding a new IoT system into the fault monitoring framework requires **zero code changes** — only a new config file.

## Architecture

```
                          +-----------------------+
                          |   JSON Config File    |
                          |  (per IoT system)     |
                          +----------+------------+
                                     |
            +------------------------+-------------------------+
            |                                                  |
  +---------v----------+                          +------------v-----------+
  | fault_engine.py    |                          | fault-detection-cf/    |
  | (Standalone CLI)   |                          | (Firebase Cloud Func.) |
  |                    |                          |                        |
  | - REST API + JWT   |                          | - Firebase Admin SDK   |
  | - Runs anywhere    |                          | - Serverless (GCP)     |
  | - Continuous or    |                          | - Scheduled (2 min)    |
  |   one-shot mode    |                          | - HTTP trigger for     |
  +--------+-----------+                          |   on-demand checks     |
           |                                      +------------+-----------+
           |                                                   |
           +-------------------+-------------------------------+
                               |
                    +----------v-----------+
                    | Firebase RTDB        |
                    |                      |
                    | reads: /data_root    |
                    | writes: /alerts_path |
                    +----------------------+
```

Both deployment modes share the same detection logic. The standalone CLI uses REST calls with optional JWT authentication, making it suitable for local testing, edge devices, or CI pipelines. The Cloud Functions version uses the Firebase Admin SDK and runs serverlessly on GCP, triggered on a schedule or via HTTP.

## Fault Types

The engine implements seven fault detectors that cover the most common IoT failure modes:

**STALE_HEARTBEAT** — The device's timestamp field hasn't been updated within the configured timeout window. Indicates the device may have lost connectivity, crashed, or lost power. Severity: CRIT.

**MISSING_FIELD** — An expected sensor or property field is absent from the telemetry snapshot. This can indicate a sensor hardware failure, firmware bug, or data pipeline issue. Severity: WARN.

**OUT_OF_RANGE** — A numeric sensor value falls outside configured [min, max] bounds. Supports two severity tiers: WARN for values outside the normal operating range, and CRIT for values beyond critical thresholds (e.g., temperature above 40C when the warning range is 15-32C). Configurable per sensor.

**STATE_MISMATCH** — Two correlated properties contradict each other. For example, a garage door sensor reports "open" while the door-closed sensor also reports true, or a pump is running but flow rate is zero. Supports three relation types: `inverse_bool`, `equal_bool`, and `a_implies_b`.

**STUCK_READING** — A sensor has reported the identical value for N consecutive checks. This often indicates a hardware fault (dead sensor returning a fixed ADC value) or a frozen firmware loop. Configurable per sensor via `stuck_threshold`.

**RAPID_DRIFT** — A sensor value is changing faster than is physically plausible. For example, soil moisture jumping 20% per second when the physical process should take minutes. Helps catch electrical noise, wiring faults, or data corruption. Configurable per sensor via `max_drift_per_s`.

**TIME_AWARE_VIOLATION** — A value that is normal during the day but abnormal at night (or vice versa). For example, a plant light sensor reading 5000 lux at 2 AM suggests a light was left on during the plant's rest period. Configurable with night hour windows and separate thresholds.

## Config Schema

Each IoT system is described by a single JSON config file. The engine reads this file to know what to monitor and how.

```json
{
  "system_name": "Human-readable system name",

  "firebase": {
    "database_url": "https://<project>.firebaseio.com",
    "auth_method": "none | secret | service_account",
    "service_account_path": "path/to/key.json"
  },

  "data_root": "/path/to/telemetry/snapshot",
  "alerts_path": "/path/to/write/alerts",

  "heartbeat": {
    "field": "timestamp",
    "timeout_s": 120
  },

  "history_depth": 5,

  "sensors": [
    {
      "name": "sensor_display_name",
      "field": "rtdb_field_name",
      "type": "number | boolean",
      "min": 0,
      "max": 100,
      "unit": "%",
      "critical_below": -10,
      "critical_above": 110,
      "max_drift_per_s": 5.0,
      "stuck_threshold": 5
    }
  ],

  "state_coherence": [
    {
      "name": "rule_group_name",
      "rules": [
        {
          "field_a": "rtdb_field",
          "field_b": "rtdb_field",
          "relation": "inverse_bool | equal_bool | a_implies_b"
        }
      ]
    }
  ],

  "time_aware": [
    {
      "sensor": "rtdb_field",
      "night_hours": [19, 7],
      "night_max": 500,
      "night_severity": "WARN",
      "night_message": "Custom alert message"
    }
  ]
}
```

### Config field reference

| Field | Required | Description |
|-------|----------|-------------|
| `system_name` | Yes | Display name used in alert messages |
| `firebase.database_url` | Yes (standalone) | RTDB URL. Not needed in Cloud Functions (uses Admin SDK default). |
| `firebase.auth_method` | Yes (standalone) | Authentication: `none` (public DB), `secret` (legacy DB secret), `service_account` (JWT) |
| `data_root` | Yes | RTDB path to the telemetry snapshot (flat key-value object) |
| `alerts_path` | No | RTDB path where alerts are written. If omitted, alerts are only returned, not persisted. |
| `heartbeat.field` | No | Timestamp field name. Engine also checks fallbacks: `timestamp`, `last_update_ms`, `ts_ms`. |
| `heartbeat.timeout_s` | No | Seconds before a stale heartbeat is flagged. Default: 120. |
| `history_depth` | No | Number of readings to retain for stuck/drift detection. Default: 5. |
| `sensors[].name` | Yes | Human-readable sensor name for alerts |
| `sensors[].field` | Yes | Exact RTDB field name in the telemetry snapshot |
| `sensors[].type` | Yes | `number` or `boolean` |
| `sensors[].min / max` | No | Normal operating range (numbers only) |
| `sensors[].critical_below / critical_above` | No | Thresholds that escalate from WARN to CRIT |
| `sensors[].max_drift_per_s` | No | Maximum allowed rate of change per second |
| `sensors[].stuck_threshold` | No | Consecutive identical readings before flagging |
| `state_coherence[].rules[].relation` | Yes | `inverse_bool`: A and B should be opposite. `equal_bool`: A and B should match. `a_implies_b`: if A is true, B must also be true. |
| `time_aware[].night_hours` | Yes | `[start_hour, end_hour]` in 24h format. Night = start <= hour OR hour < end. |

## Existing Configs

The framework currently includes configs for three systems:

| Config | System | Sensors | Key Rules |
|--------|--------|---------|-----------|
| `plant_monitoring.json` | Smart Peace Lily (Domino) | soil moisture, temp, humidity, lux, pressure | Night-time light violation (19:00-07:00) |
| `smart_home.json` | Smart Home System | flame, heat, smoke, distance, signal strength, 3x light brightness | Garage door inverse_bool, WiFi a_implies_b |
| `smart_lights.json` | Smart Hub of Lights | 3x PIR motion, 3x light brightness, current, power | PIR-to-light a_implies_b sync rules |

## Usage

### Standalone CLI

One-shot check against a single system:

```bash
python fault_engine.py --config configs/plant_monitoring.json
```

Continuous monitoring at a custom interval:

```bash
python fault_engine.py --config configs/smart_home.json --continuous --interval 60
```

Multi-system monitoring (checks all configs in a directory):

```bash
python fault_engine.py --multi --config-dir configs/ --interval 120
```

### Firebase Cloud Functions

The cloud deployment runs on Firebase Cloud Functions (2nd gen, Python 3.10) in the `iot-smart-plant-65ec1` project. See `fault-detection-cf/DEPLOY.md` for full deployment instructions.

**Scheduled function** — `check_faults_scheduled` runs every 2 minutes via Cloud Scheduler:
- Reads live telemetry from RTDB
- Runs the full detection pipeline
- Writes structured alerts to the configured `alerts_path`

**HTTP function** — `check_faults_http` for on-demand checks:

```bash
# Default config (plant_monitoring.json)
curl https://us-central1-iot-smart-plant-65ec1.cloudfunctions.net/check_faults_http

# Specific config
curl "https://...cloudfunctions.net/check_faults_http?config=smart_home.json"
```

## Alert Output Structure

All alerts follow a consistent structure regardless of the system being monitored:

```json
{
  "last_checked_ms": 1774253021527,
  "last_checked_iso": "2026-03-23T08:03:41.527630+00:00",
  "total_faults": 3,
  "fault_summary": {
    "CRIT": 0,
    "WARN": 3,
    "INFO": 0
  },
  "system_healthy": false,
  "faults": {
    "fault_1": {
      "code": "OUT_OF_RANGE",
      "severity": "WARN",
      "subsystem": "Smart Peace Lily (Domino)",
      "component": "soil_moisture",
      "detail": "soil_moisture=73.0% outside [15, 65]%",
      "ts_ms": 1774253021527,
      "value": 73.0,
      "expected": "[15, 65]%"
    }
  }
}
```

Faults are sorted by severity (CRIT first, then WARN, then INFO) and capped at 10 per check by default. The `system_healthy` boolean provides a quick status flag for dashboards or automated responses.

## Onboarding a New System

To add fault monitoring for a new IoT system:

1. **Identify the RTDB structure.** Open the Firebase console and locate the path where your device writes telemetry. Note the exact field names (these are case-sensitive).

2. **Create a config JSON.** Copy an existing config as a template and update:
   - `system_name` — descriptive name for alerts
   - `firebase.database_url` and `firebase.auth_method`
   - `data_root` — path to the flat telemetry object
   - `alerts_path` — where to write alerts
   - `sensors` — one entry per field you want to monitor
   - `state_coherence` — any cross-field consistency rules
   - `time_aware` — any day/night behavioral rules

3. **Test locally** with the standalone engine:
   ```bash
   python fault_engine.py --config configs/your_system.json
   ```

4. **Deploy to Cloud Functions** by copying the config to `fault-detection-cf/functions/configs/` and either adding a new scheduled function entry in `main.py` or using the HTTP endpoint with `?config=your_system.json`.

## Relation to the ArchML Framework

This fault engine serves as the **runtime maintenance layer** of the ArchML-driven IoT framework. The relationship between components is:

- **ArchML model** defines the system architecture: what components exist, what sensors they have, what their operating parameters are.
- **Config DSL / code generator** translates the architectural model into deployable firmware (Arduino wrappers) and the fault detection config.
- **Fault Detection Engine** continuously validates that the running system conforms to the architectural specification.

In this sense, the JSON config file is a **fault profile** derived from the architectural model — it captures the runtime behavioral contract that the physical system must satisfy. When the engine detects a violation, it means the running system has deviated from its architectural specification.

## File Structure

```
tools/
├── fault_engine.py              # Standalone CLI engine (690 lines)
├── fault_detection.py           # Earlier prototype (reference only)
├── configs/
│   ├── plant_monitoring.json    # Smart Peace Lily config
│   ├── smart_home.json          # Smart Home System config
│   └── smart_lights.json        # Smart Hub of Lights config
└── fault-detection-cf/          # Firebase Cloud Functions deployment
    ├── .firebaserc              # Project binding
    ├── firebase.json            # Runtime config
    ├── DEPLOY.md                # Deployment guide
    └── functions/
        ├── main.py              # Cloud Function entry points
        ├── requirements.txt     # Python dependencies
        └── configs/
            └── plant_monitoring.json
```

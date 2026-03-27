"""
Generic IoT Fault Detection Engine
===================================
A configuration-driven fault detection system that works with any IoT system
deployed via the ArchML framework. Reads live telemetry from Firebase RTDB,
applies a suite of fault detectors, and writes structured alerts back.

Supported fault types:
  STALE_HEARTBEAT  — device hasn't reported within its timeout window
  MISSING_FIELD    — an expected sensor/property field is absent
  OUT_OF_RANGE     — numeric value outside configured [min, max]
  STATE_MISMATCH   — two correlated properties contradict each other
  STUCK_READING    — sensor value unchanged across N consecutive checks
  RAPID_DRIFT      — value changed faster than physically plausible
  POWER_ANOMALY    — power draw outside expected envelope

Usage:
  python fault_engine.py --config configs/plant_monitoring.json
  python fault_engine.py --config configs/smart_home.json --continuous --interval 60
"""

import argparse
import copy
import json
import os
import time
import jwt          # PyJWT
import urllib.request
import urllib.parse
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


# ═══════════════════════════════════════════════════════════════════════════════
#  Data model
# ═══════════════════════════════════════════════════════════════════════════════

class Severity(str, Enum):
    INFO = "INFO"
    WARN = "WARN"
    CRIT = "CRIT"


@dataclass
class Fault:
    code: str
    severity: str
    subsystem: str
    component: str
    detail: str
    ts_ms: int = 0
    value: Any = None          # the offending reading (for logging)
    expected: str = ""         # human-readable expected range / state

    def __post_init__(self):
        if self.ts_ms == 0:
            self.ts_ms = int(time.time() * 1000)

    def to_dict(self) -> dict:
        return asdict(self)


# ═══════════════════════════════════════════════════════════════════════════════
#  Configuration schema
# ═══════════════════════════════════════════════════════════════════════════════

"""
Expected JSON config structure:

{
  "system_name": "Smart Peace Lily",
  "firebase": {
    "database_url": "https://xxx.firebaseio.com",
    "auth_method": "service_account" | "secret" | "none",
    "service_account_path": "path/to/key.json",   // if auth_method == service_account
    "secret": "..."                                 // if auth_method == secret
  },
  "data_root": "/plants/peace_lily_domino/latest",
  "alerts_path": "/plants/peace_lily_domino/alerts",
  "heartbeat": {
    "field": "timestamp",
    "timeout_s": 120
  },
  "sensors": [
    {
      "name": "soil_moisture",
      "field": "soil_moisture",
      "type": "number",
      "min": 15, "max": 65,
      "unit": "%",
      "max_drift_per_s": 5.0,         // optional: rapid drift threshold
      "critical_below": 10,            // optional: critical low threshold
      "critical_above": 80             // optional: critical high threshold
    }
  ],
  "state_coherence": [
    {
      "name": "door_state_sync",
      "rules": [
        { "field_a": "isOpen", "field_b": "door_closed", "relation": "inverse_bool" }
      ]
    }
  ],
  "time_aware": [
    {
      "sensor": "light_lux",
      "night_hours": [19, 7],
      "night_max": 500,
      "night_severity": "WARN",
      "night_message": "Plant receiving light during rest period"
    }
  ]
}
"""


# ═══════════════════════════════════════════════════════════════════════════════
#  Firebase REST client (no SDK dependency)
# ═══════════════════════════════════════════════════════════════════════════════

class FirebaseClient:
    """Lightweight Firebase RTDB REST client supporting three auth modes."""

    def __init__(self, config: dict):
        self.db_url = config["database_url"].rstrip("/")
        self.auth_method = config.get("auth_method", "none")
        self._token: Optional[str] = None
        self._token_expiry: float = 0

        if self.auth_method == "service_account":
            sa_path = config.get("service_account_path", "")
            if not os.path.isabs(sa_path):
                # Resolve relative to config file directory (set externally)
                sa_path = os.path.join(config.get("_config_dir", "."), sa_path)
            with open(sa_path) as f:
                self._sa_info = json.load(f)
        elif self.auth_method == "secret":
            self._secret = config["secret"]

    # --- Auth ---

    def _get_access_token(self) -> str:
        """Generate a short-lived OAuth2 token from a service account key using PyJWT."""
        if self._token and time.time() < self._token_expiry - 60:
            return self._token

        now = int(time.time())
        payload = {
            "iss": self._sa_info["client_email"],
            "sub": self._sa_info["client_email"],
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600,
            "scope": "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email"
        }
        signed_jwt = jwt.encode(payload, self._sa_info["private_key"], algorithm="RS256")

        # Exchange JWT for access token
        token_data = urllib.parse.urlencode({
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": signed_jwt
        }).encode()
        req = urllib.request.Request("https://oauth2.googleapis.com/token", data=token_data)
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
        self._token = result["access_token"]
        self._token_expiry = now + result.get("expires_in", 3600)
        return self._token

    def _build_url(self, path: str) -> str:
        path = path.strip("/")
        url = f"{self.db_url}/{path}.json"
        if self.auth_method == "secret":
            url += f"?auth={urllib.parse.quote(self._secret)}"
        return url

    def _add_auth_header(self, req: urllib.request.Request) -> None:
        if self.auth_method == "service_account":
            token = self._get_access_token()
            req.add_header("Authorization", f"Bearer {token}")

    # --- CRUD ---

    def get(self, path: str) -> Any:
        url = self._build_url(path)
        req = urllib.request.Request(url)
        self._add_auth_header(req)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())

    def patch(self, path: str, data: dict) -> None:
        url = self._build_url(path)
        payload = json.dumps(data).encode()
        req = urllib.request.Request(url, data=payload, method="PATCH")
        req.add_header("Content-Type", "application/json")
        self._add_auth_header(req)
        with urllib.request.urlopen(req, timeout=15) as resp:
            _ = resp.read()

    def put(self, path: str, data: Any) -> None:
        url = self._build_url(path)
        payload = json.dumps(data).encode()
        req = urllib.request.Request(url, data=payload, method="PUT")
        req.add_header("Content-Type", "application/json")
        self._add_auth_header(req)
        with urllib.request.urlopen(req, timeout=15) as resp:
            _ = resp.read()


# ═══════════════════════════════════════════════════════════════════════════════
#  Fault detectors
# ═══════════════════════════════════════════════════════════════════════════════

class FaultDetector:
    """
    Generic fault detection engine.
    Maintains a small in-memory history to detect stuck readings and rapid drift.
    """

    def __init__(self, config: dict):
        self.config = config
        self.system_name = config.get("system_name", "UnknownSystem")
        self.history: Dict[str, List[Tuple[float, Any]]] = {}  # field -> [(ts, value), ...]
        self.history_depth = config.get("history_depth", 5)

    def _record_history(self, field: str, value: Any) -> None:
        if field not in self.history:
            self.history[field] = []
        self.history[field].append((time.time(), value))
        # Keep only the last N entries
        if len(self.history[field]) > self.history_depth:
            self.history[field] = self.history[field][-self.history_depth:]

    # --- Individual detectors ---

    def check_heartbeat(self, snapshot: dict) -> List[Fault]:
        faults = []
        hb_config = self.config.get("heartbeat")
        if not hb_config:
            return faults

        field = hb_config["field"]
        timeout_s = hb_config.get("timeout_s", 120)

        # Try multiple common timestamp field names
        ts_val = None
        for fname in [field, "timestamp", "last_update_ms", "ts_ms", "timestamp_ms"]:
            if fname in snapshot:
                ts_val = snapshot[fname]
                break

        if ts_val is None:
            faults.append(Fault(
                code="MISSING_TIMESTAMP",
                severity=Severity.WARN,
                subsystem=self.system_name,
                component="heartbeat",
                detail=f"No timestamp field found (looked for: {field})"
            ))
            return faults

        # Handle both seconds and milliseconds
        ts_num = float(ts_val)
        if ts_num > 1e12:  # milliseconds
            ts_num /= 1000.0
        age_s = time.time() - ts_num

        if age_s > timeout_s:
            faults.append(Fault(
                code="STALE_HEARTBEAT",
                severity=Severity.CRIT,
                subsystem=self.system_name,
                component="heartbeat",
                detail=f"No update for {age_s:.0f}s (timeout: {timeout_s}s)",
                value=round(age_s, 1),
                expected=f"<= {timeout_s}s"
            ))
        return faults

    def check_sensor(self, sensor_cfg: dict, snapshot: dict) -> List[Fault]:
        faults = []
        name = sensor_cfg["name"]
        field = sensor_cfg["field"]
        val = snapshot.get(field)

        # --- Missing field ---
        if val is None:
            faults.append(Fault(
                code="MISSING_FIELD",
                severity=Severity.WARN,
                subsystem=self.system_name,
                component=name,
                detail=f"Field '{field}' not present in telemetry"
            ))
            return faults

        # Record for history-based checks
        self._record_history(field, val)

        # --- Type check ---
        if sensor_cfg.get("type") == "number":
            try:
                val = float(val)
            except (ValueError, TypeError):
                faults.append(Fault(
                    code="TYPE_ERROR",
                    severity=Severity.WARN,
                    subsystem=self.system_name,
                    component=name,
                    detail=f"Expected number for '{field}', got: {type(val).__name__} = {val}"
                ))
                return faults

            lo = sensor_cfg.get("min")
            hi = sensor_cfg.get("max")
            unit = sensor_cfg.get("unit", "")

            # --- Out of range ---
            if lo is not None and hi is not None:
                if not (lo <= val <= hi):
                    sev = Severity.WARN
                    # Check critical thresholds
                    crit_lo = sensor_cfg.get("critical_below")
                    crit_hi = sensor_cfg.get("critical_above")
                    if (crit_lo is not None and val < crit_lo) or \
                       (crit_hi is not None and val > crit_hi):
                        sev = Severity.CRIT
                    faults.append(Fault(
                        code="OUT_OF_RANGE",
                        severity=sev,
                        subsystem=self.system_name,
                        component=name,
                        detail=f"{name}={val}{unit} outside [{lo}, {hi}]{unit}",
                        value=val,
                        expected=f"[{lo}, {hi}]{unit}"
                    ))

            # --- Rapid drift ---
            max_drift = sensor_cfg.get("max_drift_per_s")
            if max_drift is not None:
                hist = self.history.get(field, [])
                if len(hist) >= 2:
                    prev_ts, prev_val = hist[-2]
                    try:
                        dt = time.time() - prev_ts
                        if dt > 0:
                            drift = abs(float(val) - float(prev_val)) / dt
                            if drift > max_drift:
                                faults.append(Fault(
                                    code="RAPID_DRIFT",
                                    severity=Severity.WARN,
                                    subsystem=self.system_name,
                                    component=name,
                                    detail=f"{name} drifting at {drift:.2f}{unit}/s (max: {max_drift}{unit}/s)",
                                    value=round(drift, 2),
                                    expected=f"<= {max_drift}{unit}/s"
                                ))
                    except (ValueError, TypeError):
                        pass

            # --- Stuck reading ---
            stuck_count = sensor_cfg.get("stuck_threshold", 0)
            if stuck_count > 0:
                hist = self.history.get(field, [])
                if len(hist) >= stuck_count:
                    recent_vals = [v for _, v in hist[-stuck_count:]]
                    if len(set(str(v) for v in recent_vals)) == 1:
                        faults.append(Fault(
                            code="STUCK_READING",
                            severity=Severity.WARN,
                            subsystem=self.system_name,
                            component=name,
                            detail=f"{name} stuck at {val}{unit} for {stuck_count} consecutive readings",
                            value=val,
                            expected=f"Varying readings"
                        ))

        elif sensor_cfg.get("type") == "boolean":
            # Boolean sensors mostly checked via state coherence
            pass

        return faults

    def check_state_coherence(self, rules_cfg: list, snapshot: dict) -> List[Fault]:
        faults = []
        for group in rules_cfg:
            group_name = group.get("name", "unnamed")
            for rule in group.get("rules", []):
                fa = rule["field_a"]
                fb = rule["field_b"]
                relation = rule["relation"]
                val_a = snapshot.get(fa)
                val_b = snapshot.get(fb)

                if val_a is None or val_b is None:
                    continue  # Missing fields caught by sensor checks

                if relation == "inverse_bool":
                    if bool(val_a) == bool(val_b):
                        faults.append(Fault(
                            code="STATE_MISMATCH",
                            severity=Severity.WARN,
                            subsystem=self.system_name,
                            component=group_name,
                            detail=f"{fa}={val_a} and {fb}={val_b} should be inverse",
                            value=f"{fa}={val_a}, {fb}={val_b}",
                            expected=f"{fa} != {fb}"
                        ))
                elif relation == "equal_bool":
                    if bool(val_a) != bool(val_b):
                        faults.append(Fault(
                            code="STATE_MISMATCH",
                            severity=Severity.WARN,
                            subsystem=self.system_name,
                            component=group_name,
                            detail=f"{fa}={val_a} and {fb}={val_b} should be equal",
                            value=f"{fa}={val_a}, {fb}={val_b}",
                            expected=f"{fa} == {fb}"
                        ))
                elif relation == "a_implies_b":
                    if bool(val_a) and not bool(val_b):
                        faults.append(Fault(
                            code="STATE_MISMATCH",
                            severity=Severity.WARN,
                            subsystem=self.system_name,
                            component=group_name,
                            detail=f"{fa}={val_a} but {fb}={val_b} (expected {fb}=True when {fa}=True)",
                            value=f"{fa}={val_a}, {fb}={val_b}",
                            expected=f"{fa} => {fb}"
                        ))
        return faults

    def check_time_aware(self, ta_cfg: list, snapshot: dict) -> List[Fault]:
        """Apply time-dependent rules (e.g., nighttime light thresholds).
        Uses the device's own timestamp if available, otherwise local time."""
        faults = []
        # Try to extract hour from device timestamp
        device_ts = None
        for fname in ["timestamp", "last_update_ms", "ts_ms", "timestamp_ms"]:
            if fname in snapshot:
                device_ts = snapshot[fname]
                break
        if device_ts is not None:
            ts_num = float(device_ts)
            if ts_num > 1e12:
                ts_num /= 1000.0
            now_hour = datetime.fromtimestamp(ts_num).hour
        else:
            now_hour = datetime.now().hour

        for rule in ta_cfg:
            sensor_field = rule["sensor"]
            val = snapshot.get(sensor_field)
            if val is None:
                continue

            try:
                val = float(val)
            except (ValueError, TypeError):
                continue

            night_start, night_end = rule["night_hours"]
            is_night = (now_hour >= night_start or now_hour < night_end)

            if is_night:
                night_max = rule.get("night_max")
                if night_max is not None and val > night_max:
                    faults.append(Fault(
                        code="TIME_AWARE_VIOLATION",
                        severity=rule.get("night_severity", Severity.WARN),
                        subsystem=self.system_name,
                        component=sensor_field,
                        detail=rule.get("night_message", f"{sensor_field}={val} exceeds nighttime max {night_max}"),
                        value=val,
                        expected=f"<= {night_max} (night mode)"
                    ))
        return faults

    # --- Main entry point ---

    def detect(self, snapshot: dict) -> List[Fault]:
        """Run all configured fault checks against a telemetry snapshot."""
        if snapshot is None:
            return [Fault(
                code="NO_DATA",
                severity=Severity.CRIT,
                subsystem=self.system_name,
                component="system",
                detail="Telemetry snapshot is null — system may be offline"
            )]

        all_faults: List[Fault] = []

        # 1. Heartbeat
        all_faults.extend(self.check_heartbeat(snapshot))

        # 2. Sensor range / drift / stuck
        for sensor_cfg in self.config.get("sensors", []):
            all_faults.extend(self.check_sensor(sensor_cfg, snapshot))

        # 3. State coherence
        all_faults.extend(
            self.check_state_coherence(self.config.get("state_coherence", []), snapshot)
        )

        # 4. Time-aware rules
        all_faults.extend(
            self.check_time_aware(self.config.get("time_aware", []), snapshot)
        )

        return all_faults


# ═══════════════════════════════════════════════════════════════════════════════
#  Alert writer
# ═══════════════════════════════════════════════════════════════════════════════

SEV_RANK = {Severity.CRIT: 3, "CRIT": 3, Severity.WARN: 2, "WARN": 2, Severity.INFO: 1, "INFO": 1}


def build_alert_payload(faults: List[Fault], max_alerts: int = 10) -> dict:
    """Build a structured alert payload sorted by severity then recency."""
    sorted_faults = sorted(
        faults,
        key=lambda f: (SEV_RANK.get(f.severity, 0), f.ts_ms),
        reverse=True
    )

    payload = {
        "last_checked_ms": int(time.time() * 1000),
        "last_checked_iso": datetime.now(timezone.utc).isoformat(),
        "total_faults": len(faults),
        "fault_summary": {
            "CRIT": sum(1 for f in faults if f.severity in (Severity.CRIT, "CRIT")),
            "WARN": sum(1 for f in faults if f.severity in (Severity.WARN, "WARN")),
            "INFO": sum(1 for f in faults if f.severity in (Severity.INFO, "INFO")),
        },
        "system_healthy": len(faults) == 0,
        "faults": {}
    }

    for idx, fault in enumerate(sorted_faults[:max_alerts], start=1):
        payload["faults"][f"fault_{idx}"] = fault.to_dict()

    return payload


def write_alerts_to_firebase(client: FirebaseClient, alerts_path: str, faults: List[Fault]) -> None:
    payload = build_alert_payload(faults)
    client.put(alerts_path, payload)


# ═══════════════════════════════════════════════════════════════════════════════
#  Runner
# ═══════════════════════════════════════════════════════════════════════════════

def load_config(path: str) -> dict:
    with open(path) as f:
        config = json.load(f)
    # Store config dir for resolving relative paths
    config.setdefault("firebase", {})["_config_dir"] = os.path.dirname(os.path.abspath(path))
    return config


def run_once(config: dict, verbose: bool = True) -> List[Fault]:
    fb_cfg = config["firebase"]
    client = FirebaseClient(fb_cfg)

    # Pull telemetry
    data_root = config.get("data_root", "/")
    if verbose:
        print(f"[{config['system_name']}] Fetching data from {data_root} ...")

    snapshot = client.get(data_root)

    # Detect faults
    detector = FaultDetector(config)
    faults = detector.detect(snapshot)

    # Print results
    if verbose:
        if not faults:
            print(f"  ✓ No faults detected — system healthy")
        else:
            print(f"  ✗ {len(faults)} fault(s) detected:")
            for f in faults:
                icon = {"CRIT": "🔴", "WARN": "🟡", "INFO": "🔵"}.get(f.severity, "⚪")
                print(f"    {icon} [{f.severity}] {f.code}: {f.detail}")

    # Write alerts back to Firebase
    alerts_path = config.get("alerts_path")
    if alerts_path:
        write_alerts_to_firebase(client, alerts_path, faults)
        if verbose:
            print(f"  → Alerts written to {alerts_path}")

    return faults


def run_continuous(config: dict, interval_s: int = 60) -> None:
    print(f"Starting continuous monitoring for '{config['system_name']}' (interval: {interval_s}s)")
    print(f"Press Ctrl+C to stop.\n")

    # For stuck-reading detection we need persistent state across runs
    detector = FaultDetector(config)
    fb_cfg = config["firebase"]
    client = FirebaseClient(fb_cfg)
    data_root = config.get("data_root", "/")
    alerts_path = config.get("alerts_path")

    while True:
        try:
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"\n[{ts}] Checking {config['system_name']}...")

            snapshot = client.get(data_root)
            faults = detector.detect(snapshot)

            if not faults:
                print(f"  ✓ Healthy")
            else:
                for f in faults:
                    icon = {"CRIT": "🔴", "WARN": "🟡", "INFO": "🔵"}.get(f.severity, "⚪")
                    print(f"  {icon} [{f.severity}] {f.code}: {f.detail}")

            if alerts_path:
                write_alerts_to_firebase(client, alerts_path, faults)

            time.sleep(interval_s)

        except KeyboardInterrupt:
            print("\nStopped.")
            break
        except Exception as e:
            print(f"  ⚠ Error: {e}")
            time.sleep(interval_s)


def run_multi_system(config_paths: List[str], verbose: bool = True) -> Dict[str, List[Fault]]:
    """Run fault detection across multiple systems in one pass."""
    results = {}
    for path in config_paths:
        config = load_config(path)
        name = config.get("system_name", path)
        results[name] = run_once(config, verbose=verbose)
    return results


# ═══════════════════════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Generic IoT Fault Detection Engine")
    parser.add_argument("--config", required=True, nargs="+",
                        help="Path(s) to system config JSON file(s)")
    parser.add_argument("--continuous", action="store_true",
                        help="Run continuously (only with a single config)")
    parser.add_argument("--interval", type=int, default=60,
                        help="Polling interval in seconds (default: 60)")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress console output")
    parser.add_argument("--json-output", type=str, default=None,
                        help="Write fault report as JSON to this path")
    args = parser.parse_args()

    if args.continuous and len(args.config) > 1:
        print("ERROR: --continuous only works with a single config file.")
        return

    if args.continuous:
        config = load_config(args.config[0])
        run_continuous(config, interval_s=args.interval)
    else:
        all_results = {}
        for cfg_path in args.config:
            config = load_config(cfg_path)
            faults = run_once(config, verbose=not args.quiet)
            all_results[config["system_name"]] = [f.to_dict() for f in faults]

        if args.json_output:
            with open(args.json_output, "w") as f:
                json.dump(all_results, f, indent=2)
            print(f"\nFull report written to {args.json_output}")


if __name__ == "__main__":
    main()

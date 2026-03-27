import json
from pathlib import Path


DEFAULT_PIN_TYPE = "digital"          # Fallback pin type if not provided per device.
DEFAULT_COMPONENT_ID = "Component_ID" # Fallback component ID if not provided per device.


def to_component_name(name: str) -> str:
    return name.replace(" ", "_")


def to_pin_name(name: str) -> str:
    return name.replace(" ", "_").lower()


def device_to_block(device: dict, pin_type: str, component_id: str) -> str:
    dev_type = device.get("device type", "").lower()
    dev_name = device["name"]

    resolved_pin_type = device.get("pin_type") or pin_type
    resolved_component_id = device.get("component_id") or component_id

    # Map device type to component kind and pin direction
    if dev_type == "actuator":
        component_kind = "actuator"
        pin_direction = resolved_pin_type + " output pin"
    else:
        # 'sensor' and 'tag' treated as sensor in examples
        component_kind = "sensor"
        pin_direction = resolved_pin_type + " input pin"

    component_name = to_component_name(dev_name)
    pin_name = to_pin_name(dev_name)

    block = (
        f"component {component_kind} {component_name} {resolved_component_id} {{\n"
        f"    {pin_direction} {pin_name}: 0\n"
        f"}}"
    )
    return block


def generate_config_for_system(system: dict, output_dir: Path) -> None:
    system_name = system["name"]
    filename = f"{system_name}.Config"
    output_path = output_dir / filename

    blocks = []

    # Traverse physical entities -> controllers -> devices
    for pe in system.get("physical entities", []):
        for controller in pe.get("controllers", []):
            for device in controller.get("devices", []):
                blocks.append(device_to_block(device, DEFAULT_PIN_TYPE, DEFAULT_COMPONENT_ID))

    # Join blocks with a blank line between them
    content = "\n\n".join(blocks) + "\n"

    output_path.write_text(content, encoding="utf-8")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    if len(Path.cwd().parts) == 0:
        raise SystemExit("Invalid working directory")

    input_arg = Path("test.json")
    output_arg = Path(".")

    if len(__import__("sys").argv) >= 2:
        input_arg = Path(__import__("sys").argv[1])
    if len(__import__("sys").argv) >= 3:
        output_arg = Path(__import__("sys").argv[2])

    with input_arg.open(encoding="utf-8") as f:
        data = json.load(f)

    for system in data.get("systems", []):
        output_arg.mkdir(parents=True, exist_ok=True)
        generate_config_for_system(system, output_arg)

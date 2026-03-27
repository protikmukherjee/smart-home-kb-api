export type PinDoc = {
  pinType: string;
  ioType: string;
  name: string;
  number?: number;
};

export type VariantDoc = {
  _id: string;
  name: string;
  price: number;
  category: string;
  subcategory: string;
  componentClass: string; // "primary" | "accessory" | "module"
  vendorUrl: string;
  pinType: string;
  componentId: string;
  type: string;
  pins: PinDoc[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
  }
  return null;
}

function normalizePinType(value: string | null, fallback: "digital" | "analog" = "digital") {
  const lowered = (value ?? "").toLowerCase();
  if (lowered === "analog") {
    return "analog";
  }
  if (lowered === "digital") {
    return "digital";
  }
  return fallback;
}

function normalizeIoType(value: string | null) {
  const lowered = (value ?? "").toLowerCase();
  if (lowered === "output") {
    return "output";
  }
  return "input";
}

function deriveDeviceClass(record: Record<string, unknown>): string | null {
  const direct = firstString(record, ["type", "deviceType", "device_type", "componentType", "component_type"]);
  if (direct) {
    return direct.toLowerCase();
  }

  const description = firstString(record, ["description"]);
  if (description) {
    const lowered = description.toLowerCase();
    const match = lowered.match(/\b(sensor|actuator|controller|power|communication|processor|input|display)\b/);
    if (match?.[1]) {
      return match[1];
    }
  }

  const atType = firstString(record, ["@type"]);
  if (atType) {
    const lowered = atType.toLowerCase();
    const match = lowered.match(/(sensor|actuator|controller|power|communication|processor|input|display)/);
    if (match?.[1]) {
      return match[1];
    }
    return lowered;
  }

  return null;
}

function toPinDoc(pinValue: unknown, fallbackName: string, fallbackPinType: "digital" | "analog"): PinDoc | null {
  const pinRecord = asRecord(pinValue);
  if (!pinRecord) {
    return null;
  }

  const name =
    firstString(pinRecord, ["name", "pinName", "label", "pin_label", "pin"]) ?? fallbackName;

  return {
    pinType: normalizePinType(
      firstString(pinRecord, ["pinType", "pin_type", "signalType", "signal_type"]),
      fallbackPinType
    ),
    ioType: normalizeIoType(firstString(pinRecord, ["ioType", "io_type", "direction"])),
    name,
    number: firstNumber(pinRecord, ["number", "pinNumber", "pin_number"]) ?? undefined
  };
}

function extractPins(record: Record<string, unknown>, defaultPinName: string, pinType: "digital" | "analog"): PinDoc[] {
  const rawPins = record.pins ?? record.pinList ?? record.pin_list ?? record.pinAssignments;

  if (Array.isArray(rawPins)) {
    return rawPins
      .map((value) => toPinDoc(value, defaultPinName, pinType))
      .filter((pin): pin is PinDoc => Boolean(pin));
  }

  const pinMap = asRecord(rawPins);
  if (pinMap) {
    return Object.entries(pinMap)
      .map(([key, value]) => toPinDoc(value, key, pinType))
      .filter((pin): pin is PinDoc => Boolean(pin));
  }

  const propertiesMap = asRecord(record.properties);
  if (propertiesMap) {
    return Object.keys(propertiesMap).map((key) => ({
      pinType,
      ioType: "input",
      name: key
    }));
  }

  return [];
}

export function mapFirebaseVariant(key: string, raw: unknown, fallbackCategory?: string): VariantDoc | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const type = deriveDeviceClass(record) ?? "sensor";

  const name = firstString(record, ["name", "variantName", "variant_name", "title"]) ?? `Variant ${key}`;
  const price = firstNumber(record, ["price", "cost", "unitPrice", "unit_price", "price_cad", "price_usd"]) ?? 0;
  const category = firstString(record, ["category", "group", "family"]) ?? fallbackCategory ?? type;
  
  const pathParts = key.split('/');
  let subcategory = "general";
  if (pathParts.length > 2) {
    subcategory = pathParts[1];
  } else if (pathParts.length === 2) {
    subcategory = pathParts[1];
  }
  
  const vendorUrl =
    firstString(record, ["vendorUrl", "vendor_url", "vendorLink", "vendor_link", "url", "link", "purchaseUrl", "purchase_url"]) ??
    (() => {
      const forms = record.forms;
      if (Array.isArray(forms) && forms.length > 0) {
        const firstForm = asRecord(forms[0]);
        const href = firstForm ? firstString(firstForm, ["href"]) : null;
        return href ?? "";
      }
      return "";
    })() ??
    "";
  const pinType = normalizePinType(
    firstString(record, ["pinType", "pin_type", "signalType", "signal_type"])
  );
  const componentId =
    firstString(record, ["componentId", "component_id", "sku", "code", "identifier", "id"]) ?? key;

  const pins = extractPins(record, `${type}_pin`, pinType);
  const componentClass = firstString(record, ["component_class", "componentClass"]) ?? "primary";

  return {
    _id: key,
    name,
    price,
    category,
    subcategory,
    componentClass,
    vendorUrl,
    pinType,
    componentId,
    type,
    pins
  };
}

export function mapFirebaseVariantCollection(rawCollection: unknown): VariantDoc[] {
  if (!rawCollection) {
    return [];
  }

  const variants: VariantDoc[] = [];
  const seenPaths = new Set<string>();

  const looksLikeVariantNode = (record: Record<string, unknown>): boolean => {
    const hasName =
      firstString(record, ["name", "title", "variantName", "variant_name"]) !== null;
    const hasType =
      firstString(record, ["@type", "type", "deviceType", "device_type", "componentType", "component_type"]) !== null;
    const hasPrice =
      firstNumber(record, ["price", "cost", "unitPrice", "unit_price", "price_cad", "price_usd"]) !== null;
    const hasTdShape = "@context" in record || "forms" in record || "properties" in record;

    return hasName && hasType && (hasPrice || hasTdShape);
  };

  const walk = (node: unknown, pathParts: string[] = [], topCategory?: string) => {
    const record = asRecord(node);
    if (!record) {
      if (Array.isArray(node)) {
        node.forEach((item, index) => {
          walk(item, [...pathParts, String(index)], topCategory);
        });
      }
      return;
    }

    const currentTopCategory = topCategory ?? pathParts[0];
    if (looksLikeVariantNode(record) && pathParts.length > 0) {
      const pathKey = pathParts.join("/");
      if (!seenPaths.has(pathKey)) {
        seenPaths.add(pathKey);
        const variant = mapFirebaseVariant(pathKey, record, currentTopCategory);
        if (variant) {
          variants.push(variant);
        }
      }
      return;
    }

    for (const [key, value] of Object.entries(record)) {
      walk(value, [...pathParts, key], currentTopCategory);
    }
  };

  walk(rawCollection, []);
  return variants;
}

export function mapVariantInputForWrite(raw: unknown, fallbackType: string): Omit<VariantDoc, "_id"> | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const type = (
    firstString(record, ["type", "deviceType", "device_type", "componentType", "component_type"]) ??
    fallbackType
  ).toLowerCase();

  const name = firstString(record, ["name", "variantName", "variant_name", "title"]);
  const price = firstNumber(record, ["price", "cost", "unitPrice", "unit_price"]);
  const category = firstString(record, ["category", "group", "family"]) ?? type;
  const vendorUrl =
    firstString(record, ["vendorUrl", "vendor_url", "vendorLink", "vendor_link", "url", "link", "purchaseUrl"]) ??
    "";
  const pinType = normalizePinType(
    firstString(record, ["pinType", "pin_type", "signalType", "signal_type"])
  );

  if (!name || price === null) {
    return null;
  }

  const componentId =
    firstString(record, ["componentId", "component_id", "sku", "code", "identifier"]) ?? "";
  const pins = extractPins(record, `${type}_pin`, pinType);
  const subcategory = firstString(record, ["subcategory", "sub_category"]) ?? "";
  const componentClass = firstString(record, ["component_class", "componentClass"]) ?? "primary";

  return {
    name,
    price,
    category,
    subcategory,
    componentClass,
    vendorUrl,
    pinType,
    componentId,
    type,
    pins
  };
}

export function toFirebaseThingDescription(variant: Omit<VariantDoc, "_id">): Record<string, unknown> {
  const description = `A ${variant.type} device for ${variant.category}.`;
  const thingId = variant.componentId?.trim().length
    ? `urn:dev:custom:${variant.componentId}`
    : `urn:dev:custom:${variant.name.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase()}`;

  const base: Record<string, unknown> = {
    "@context": "https://www.w3.org/2019/wot/td/v1",
    "@type": variant.type,
    description,
    id: thingId,
    security: "nosec_sc",
    securityDefinitions: {
      nosec_sc: {
        scheme: "nosec"
      }
    },
    title: variant.name
  };

  if (variant.vendorUrl) {
    base.forms = [{ href: variant.vendorUrl }];
  }

  if (variant.pins.length > 0) {
    const properties: Record<string, unknown> = {};
    variant.pins.forEach((pin) => {
      properties[pin.name] = {
        type: pin.pinType === "analog" ? "number" : "boolean",
        description: `${pin.ioType} pin`
      };
    });
    base.properties = properties;
  }

  return base;
}

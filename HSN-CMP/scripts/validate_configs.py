import json
import glob
import os
from jsonschema import validate, ValidationError

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMAS_DIR = os.path.join(ROOT, "configs", "schemas")

def load_schema(name):
    path = os.path.join(SCHEMAS_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    cfg_schema = load_schema("config.schema.json")
    manifest_schema = load_schema("manifest.schema.json")
    errors = []
    # validate manifests
    for p in glob.glob(os.path.join(ROOT, "plugins", "*", "manifest.json")):
        with open(p, "r", encoding="utf-8") as f:
            doc = json.load(f)
        try:
            validate(instance=doc, schema=manifest_schema)
            print(f"OK manifest: {p}")
        except ValidationError as e:
            print(f"ERROR manifest: {p} -> {e.message}")
            errors.append((p, str(e)))

    # validate configs
    for p in glob.glob(os.path.join(ROOT, "configs", "*.json")):
        # skip schemas
        if os.path.basename(p).startswith("schemas") or p.endswith("schema.json"):
            continue
        with open(p, "r", encoding="utf-8") as f:
            doc = json.load(f)
        try:
            validate(instance=doc, schema=cfg_schema)
            print(f"OK config: {p}")
        except ValidationError as e:
            print(f"ERROR config: {p} -> {e.message}")
            errors.append((p, str(e)))

    if errors:
        print("Validation finished with errors.")
        return 2
    print("All validations passed.")
    return 0

if __name__ == '__main__':
    import sys
    sys.exit(main())

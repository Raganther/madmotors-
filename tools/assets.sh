#!/bin/sh
# npm run assets [ids]: build the Blender assets headless (blender/build.py). Blender comes as the `bpy` Python module.
python3 -c 'import bpy' 2>/dev/null || pip install -q bpy || { echo 'needs Python 3.11 and `pip install bpy`'; exit 1; }
# the car families' numbers (src/data/families.js) for blender/chassis.py
mkdir -p "$(dirname "$0")/../blender/out" && node -e "import('./src/data/families.js').then(m => require('fs').writeFileSync('blender/out/families.json', JSON.stringify({ cars: Object.fromEntries(m.FAMILY_IDS.map(id => [id, m.chassisOf(id)])) })))" || exit 1
exec python3 "$(dirname "$0")/../blender/build.py" "$@"

#!/bin/sh
# npm run assets [ids]: build the Blender assets headless (blender/build.py). Blender comes as the `bpy` Python module.
python3 -c 'import bpy' 2>/dev/null || pip install -q bpy || { echo 'needs Python 3.11 and `pip install bpy`'; exit 1; }
exec python3 "$(dirname "$0")/../blender/build.py" "$@"

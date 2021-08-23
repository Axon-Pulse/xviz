#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/../data/generated/arbe/StableBridge"


# Start server & web app
cd "${SCRIPT_DIR}/../modules/server" && ./bin/xvizserver -d "${OUTPUT_DIR}" --port 8082 &
pids[1]=$!

echo "##"
echo "## XVIZ Server started."
echo "## Ctrl-c to terminate."
echo "##"

for pid in ${pids[*]}; do
    wait $pid
done
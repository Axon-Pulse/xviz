#!/bin/bash
#
# Copyright (c) 2019 Uber Technologies, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
#
# Runs KITTI converter if generated output is not found
# Runs server & client in background
# Terminates background process if signal is triggered

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

show_help() {
  echo " -h display help information"
  echo " -f force KITTI xviz conversion"
}

# Handle options
force_xviz_conversion=true

while getopts "hf" opt; do
    case "$opt" in
    h|\?)
        show_help
        exit 0
        ;;
    f)  force_xviz_conversion=true
        ;;
    esac
done

# Terminate background pids
exit_script() {
  echo "Terminating XVIZ server & client!"
  trap - SIGINT SIGTERM
  for pid in ${pids[*]}; do
    echo "Terminating ${pid}"
    kill ${pid}
  done
}
trap exit_script SIGINT SIGTERM

# Run KITTI XVIZ conversion
# check for both json & glb files
#INPUT_DIR="${SCRIPT_DIR}/../data/Arbe/arbe-rosbag_2020-12-29-13-34-50_processedd_10_v6_short"
#OUTPUT_DIR="${SCRIPT_DIR}/../data/generated/arbe/arbe-rosbag_2020-12-29-13-34-50_processedd_10_v6"

INPUT_DIR="${SCRIPT_DIR}/../data/Arbe/bag6_kaz"
OUTPUT_DIR="${SCRIPT_DIR}/../data/generated/arbe/bag6_kaz"


if [ "$force_xviz_conversion" = "true" ] || ([ ! -f "${OUTPUT_DIR}/1-frame.json" ] && [ ! -f "${OUTPUT_DIR}/1-frame.glb" ]) ; then
    echo "Generating default KITTI XVIZ data"
    mkdir -p "${OUTPUT_DIR}"
    (cd "${SCRIPT_DIR}/../examples/converters/kitti" && yarn && yarn start -d ${INPUT_DIR} -o "${OUTPUT_DIR}")
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

show_help() {
  echo " -h display help information"
  echo " -f force KITTI xviz conversion"
}

# Start server & web app
cd "${SCRIPT_DIR}/../modules/server" && ./bin/xvizserver -d "${OUTPUT_DIR}" --port 8083 &
pids[1]=$!

echo "##"
echo "## XVIZ Server started."
echo "## Ctrl-c to terminate."
echo "##"

for pid in ${pids[*]}; do
    wait $pid
done
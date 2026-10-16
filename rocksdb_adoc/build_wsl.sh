#!/usr/bin/env bash
# One-shot build for the REAL ADOC-on-RocksDB driver, inside WSL / Ubuntu.
# Run from the rocksdb_adoc directory:  bash build_wsl.sh
set -euo pipefail

echo ">> Installing RocksDB and build tools (needs sudo once)..."
sudo apt-get update
sudo apt-get install -y \
    build-essential cmake \
    librocksdb-dev \
    libsnappy-dev liblz4-dev libzstd-dev libbz2-dev zlib1g-dev

echo ">> Building..."
mkdir -p build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j"$(nproc)"

echo
echo ">> Done. Run it, e.g.:"
echo "   ./adoc_rocksdb /tmp/adocdb 60 --writers 4           # ADOC enabled"
echo "   ./adoc_rocksdb /tmp/adocdb_base 60 --writers 4 --no-adoc   # baseline"

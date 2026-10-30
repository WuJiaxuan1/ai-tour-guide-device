"""Validate the built P4 model/config pair, including model bytes inside assets.

This verifies packaging, not acoustic recognition or ESP32 runtime memory.
"""
import json
import struct
from pathlib import Path
from package_p1 import ROOT, BUILD, digest, validate_assets

EXPECTED_COMMAND = {"command": "feng ye jing ling", "text": "枫叶精灵", "action": "wake"}


def unpack_assets(data):
    validate_assets(data)
    count = struct.unpack_from("<I", data)[0]
    entry = struct.Struct("<32sIIHH")
    start = 12 + count * entry.size
    files = {}
    for i in range(count):
        name, size, offset, _, _ = entry.unpack_from(data, 12 + i * entry.size)
        files[name.split(b"\0")[0].decode("ascii")] = data[start + offset + 2:start + offset + 2 + size]
    return files


def unpack_models(data):
    if len(data) < 4:
        raise ValueError("Truncated model header")
    count = struct.unpack_from("<I", data)[0]
    if not 0 < count <= 32:
        raise ValueError("Invalid model count")
    cursor = 4
    models, spans = {}, []
    for _ in range(count):
        if cursor + 36 > len(data):
            raise ValueError("Truncated model table")
        name = data[cursor:cursor + 32].split(b"\0")[0].decode("ascii")
        files = struct.unpack_from("<I", data, cursor + 32)[0]
        cursor += 36
        if not name or name in models or not 0 < files <= 128:
            raise ValueError("Invalid model entry")
        models[name] = {}
        for _ in range(files):
            if cursor + 40 > len(data):
                raise ValueError("Truncated model file table")
            raw, offset, length = struct.unpack_from("<32sII", data, cursor)
            cursor += 40
            filename = raw.split(b"\0")[0].decode("ascii")
            if not filename or filename in models[name] or length == 0 or offset + length > len(data):
                raise ValueError("Invalid model file span")
            spans.append((offset, length))
            models[name][filename] = data[offset:offset + length]
    end = cursor
    for offset, length in spans:
        if offset != end:
            raise ValueError("Overlapping or discontinuous model data")
        end += length
    if end != len(data):
        raise ValueError("Trailing model bytes")
    return models


def check_wake_assets(data):
    files = unpack_assets(data)
    index = json.loads(files["index.json"])
    expected = {"language": "cn", "duration": 3000, "threshold": 0.2, "commands": [EXPECTED_COMMAND]}
    if index.get("multinet_model") != expected:
        raise ValueError("Wrong or missing custom wake command configuration")
    models = unpack_models(files["srmodels.bin"])
    if set(models) != {"mn7_cn", "fst"}:
        raise ValueError("Expected Chinese MultiNet7 plus FST, without old WakeNet")
    upstream = ROOT / "firmware/managed_components/espressif__esp-sr/model/multinet_model"
    for name, model_files in models.items():
        originals = {p.name: p.read_bytes() for p in (upstream / name).iterdir() if p.is_file()}
        if model_files != originals:
            raise ValueError("Packaged model differs from upstream files: " + name)
    previous = unpack_assets((ROOT / "releases/P3-test01/p3-xiaozhi-assets.bin").read_bytes())
    if set(files) != set(previous):
        raise ValueError("Unexpected asset set change")
    for name in files.keys() - {"index.json", "srmodels.bin"}:
        if files[name] != previous[name]:
            raise ValueError("Unexpected font/emoji change: " + name)
    previous_index = json.loads(previous["index.json"])
    if {k: v for k, v in index.items() if k != "multinet_model"} != previous_index:
        raise ValueError("Non-voice asset configuration changed")
    return {"models": sorted(models), "wake_config": expected,
            "srmodels_bytes": len(files["srmodels.bin"]), "assets_bytes": len(data),
            "assets_sha256": digest(data)}


def verify_build():
    config = (ROOT / "firmware/sdkconfig").read_text("utf-8").splitlines()
    for item in ['CONFIG_USE_CUSTOM_WAKE_WORD=y', 'CONFIG_SR_MN_CN_MULTINET7_QUANT=y',
                 'CONFIG_CUSTOM_WAKE_WORD="feng ye jing ling"', 'CONFIG_CUSTOM_WAKE_WORD_DISPLAY="枫叶精灵"',
                 'CONFIG_CUSTOM_WAKE_WORD_THRESHOLD=20', 'CONFIG_BOARD_TYPE_M5STACK_STOPWATCH=y',
                 'CONFIG_FLASH_DEFAULT_ASSETS=y', 'CONFIG_SEND_WAKE_WORD_DATA=y']:
        if item not in config:
            raise ValueError("Missing required configuration: " + item)
    if 'CONFIG_USE_AFE_WAKE_WORD=y' in config or 'CONFIG_SR_MN_CN_NONE=y' in config:
        raise ValueError("Conflicting wake configuration")
    data = (BUILD / "generated_assets.bin").read_bytes()
    result = check_wake_assets(data)
    if len(data) > 0x800000:
        raise ValueError("Assets exceed partition")
    return result


def main():
    result = verify_build()
    # A stale P3 resource bundle must not be accepted for this release.
    try:
        check_wake_assets((ROOT / "releases/P3-test01/p3-xiaozhi-assets.bin").read_bytes())
    except ValueError:
        pass
    else:
        raise AssertionError("Stale P3 resources were accepted")
    speech = unpack_assets((BUILD / "generated_assets.bin").read_bytes())["srmodels.bin"]
    for invalid in (speech[:8], speech[:-1]):
        try:
            unpack_models(invalid)
        except ValueError:
            pass
        else:
            raise AssertionError("Truncated model was accepted")
    print("PASS: built config, actual packed Chinese MultiNet7/FST bytes, maple command, unchanged UI assets, stale/truncated model rejection; acoustic and device memory tests pending")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

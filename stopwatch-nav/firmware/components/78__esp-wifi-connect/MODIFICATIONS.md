# StopWatch P3 local override

Based on 78/esp-wifi-connect 3.1.5, upstream commit 493851d512684711fa9b6168843c112ca1f55eee, MIT (see idf_component.yml and upstream repository).

This project-local override preserves the upstream manager/station and NVS storage code. The provisioning submit handler validates and saves credentials without attempting to connect while the phone is still attached to the device AP. The completion page explicitly requests the existing non-rebooting /exit endpoint after explaining the phone-hotspot handoff. Manual SSID entry is always enabled. Fragmented request bodies are read completely before parsing.

The once-per-boot list reset lives in the StopWatch board, not this component. Other NVS namespaces, device identity and cloud binding are not erased. The original managed dependency was not edited. Local override is declared in main/idf_component.yml so dependency refresh does not discard these changes.

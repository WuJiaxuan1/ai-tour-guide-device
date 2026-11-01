"""读取项目现有知识包；不复制资料、不推测游客位置、不查询实时运营信息。"""

import json
import os
from pathlib import Path

DEFAULT_KB = (Path(__file__).resolve().parent.parent / "ai-tour-guide-device"
              / "backend/knowledge/qixia-kb-mvp-v1")


def load_pois():
    root = Path(os.environ.get("QIXIA_KB_DIR") or DEFAULT_KB)
    registry = json.loads((root / "07_id_registry.json").read_text(encoding="utf-8-sig"))
    aliases = {}
    for entry in registry["places"]:
        for alias in [entry["canonicalId"], entry["displayName"], *entry.get("aliases", [])]:
            aliases[alias] = entry
    pois = []
    for line in (root / "01_pois_12.jsonl").read_text(encoding="utf-8-sig").splitlines():
        if not line.strip():
            continue
        poi = json.loads(line)
        entry = aliases.get(poi["id"], {})
        poi["id"] = entry.get("canonicalId", poi["id"])
        poi["searchNames"] = sorted(set(filter(None, [
            poi["id"], poi["name"], poi.get("canonicalName"),
            *poi.get("aliases", []), entry.get("displayName"), *entry.get("aliases", []),
        ])))
        pois.append(poi)
    return pois


def brief(poi):
    return {"id": poi["id"], "name": poi["name"], "aliases": poi["searchNames"],
            "intro": poi["oneLineIntro"], "themes": poi.get("themes", [])}


def unavailable():
    return {"success": False, "status": "knowledge_unavailable",
            "message": "景点资料暂时无法读取，请稍后再试。不要编造查询结果。"}


def list_attractions(keyword=""):
    try:
        pois = load_pois()
        keyword = keyword.strip().casefold()
        hits = [p for p in pois if not keyword or any(
            keyword in s.casefold() for s in [*p["searchNames"], *p.get("themes", [])])]
        return {"success": True, "knowledgeVersion": "qixia-kb-mvp-v1",
                "count": len(hits), "places": [brief(p) for p in hits],
                "message": "这是资料目录，不表示游客当前位置，也不表示景点当前开放。"}
    except (OSError, ValueError, KeyError, TypeError):
        return unavailable()


def get_guide(place_name):
    name = place_name.strip().casefold()
    if not name:
        return {"success": False, "status": "needs_place", "message": "请先询问游客要了解哪个景点。"}
    try:
        pois = load_pois()
        exact = [p for p in pois if name in [s.casefold() for s in p["searchNames"]]]
        hits = exact or [p for p in pois if any(s.casefold() in name for s in p["searchNames"])]
        if len(hits) != 1:
            return {"success": False, "status": "ambiguous" if hits else "not_found",
                    "message": "请明确一个景点名称；资料未收录的内容不能编造。",
                    "candidates": [brief(p) for p in hits]}
        poi = hits[0]
        return {
            "success": True, "knowledgeVersion": "qixia-kb-mvp-v1", "place": brief(poi),
            "narration30s": poi["narration30s"], "explanation": poi["plainExplanation"],
            "suggestedStayMinutes": poi.get("recommendedStayMinutes"),
            "photoSuggestion": {"text": poi.get("coupleTip", ""),
                                "sourceType": poi.get("coupleTipSource", "unknown"),
                                "isVerifiedOfficialFact": False},
            "warnings": poi.get("warnings", []), "verificationStatus": poi.get("verificationStatus"),
            "sources": sorted(set(Path(s.replace("\\", "/")).name for s in poi.get("sources", []))),
            "realtimeAvailable": False,
            "answerRules": [
                "按游客具体问题选用资料；问题所需事实没有记载时，明确资料未确认，不能用通用讲解冒充答案。",
                "首次讲解约20至40秒；遵守warnings中的限制，不补写未核实的年代、数量或传说。",
                "票价、开放、营业、人流、天气、当日红叶状态未接入实时来源，请查看景区公告或咨询现场。",
                "拍照建议是参考经验，不是官方保证；不要朗读内部字段、文件名或核验状态编码。",
                "没有游客GPS和实时路线，不得声称游客已到这里，不得编造最近设施、距离或导航进度。",
            ],
        }
    except (OSError, ValueError, KeyError, TypeError):
        return unavailable()

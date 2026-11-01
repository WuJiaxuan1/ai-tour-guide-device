"""离线检查：别名、事实边界、缺失资料以及明确景点的追问输入。"""

import os
import unittest
from unittest.mock import patch

from qixia_knowledge import get_guide, list_attractions, load_pois


class KnowledgeTests(unittest.TestCase):
    def test_all_places_and_aliases(self):
        self.assertEqual(list_attractions()["count"], 12)
        for poi in load_pois():
            for alias in poi["searchNames"]:
                with self.subTest(alias=alias):
                    self.assertEqual(get_guide(alias)["place"]["id"], poi["id"])

    def test_theme_search(self):
        self.assertEqual({p["id"] for p in list_attractions("栖霞三宝")["places"]},
                         {"mingzheng-stele", "pagoda", "buddha"})

    def test_unknown_and_pronouns_do_not_guess(self):
        for name in ["不存在的景点", "这里", "它"]:
            self.assertEqual(get_guide(name)["status"], "not_found")
        self.assertEqual(get_guide(" ")["status"], "needs_place")

    def test_multiple_places_need_disambiguation(self):
        self.assertEqual(get_guide("明镜湖与桃花湖")["status"], "ambiguous")

    def test_dynamic_conditions_are_not_live(self):
        result = get_guide("红叶谷今天红了吗")
        self.assertFalse(result["realtimeAvailable"])
        self.assertTrue(any("当日枫情" in s for s in result["warnings"]))

    def test_conflicting_history_retains_limits(self):
        result = get_guide("栖霞古寺")
        self.assertTrue(any("年份" in s for s in result["warnings"]))
        self.assertTrue(result["sources"])
        self.assertTrue(all("/" not in s and "\\" not in s for s in result["sources"]))

    def test_photo_experience_is_not_official_fact(self):
        tip = get_guide("桃花湖")["photoSuggestion"]
        self.assertEqual(tip["sourceType"], "ugc_unverified")
        self.assertFalse(tip["isVerifiedOfficialFact"])

    def test_missing_kb_reports_unavailable(self):
        with patch.dict(os.environ, {"QIXIA_KB_DIR": str(__file__)}):
            self.assertEqual(get_guide("明镜湖")["status"], "knowledge_unavailable")
            self.assertFalse(list_attractions()["success"])

if __name__ == "__main__":
    unittest.main()

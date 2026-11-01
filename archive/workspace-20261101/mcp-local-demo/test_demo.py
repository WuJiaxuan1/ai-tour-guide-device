import io
import json
import os
import time
import unittest
from unittest.mock import Mock, patch
from qixia_demo import get_current_demo_trip

class DemoTests(unittest.TestCase):
    def invoke(self, payload):
        opener = Mock()
        opener.open.return_value = io.BytesIO(json.dumps(payload).encode())
        with patch.dict(os.environ, {'QIXIA_DEMO_READ_TOKEN': 'test-only-' * 8,
                                   'QIXIA_DEMO_API': 'http://127.0.0.1:8787/api/demo-trip/current'}):
            with patch('qixia_demo.build_opener', return_value=opener):
                return get_current_demo_trip()

    def active(self):
        return {'active': True, 'id': 'test', 'revision': 2, 'updatedAt': int(time.time()*1000),
                'expiresAt': int(time.time()*1000)+60000,
                'selectedPlaces': [{'id': 'pagoda', 'name': '舍利塔', 'order': 1}],
                'entry': None, 'exit': None, 'stayMinutes': {'pagoda': 30},
                'recentQuestions': ['我想听历史'], 'focusedPlace': None}

    def test_current_snapshot_and_limits(self):
        result = self.invoke(self.active())
        self.assertTrue(result['success'])
        self.assertEqual(result['selectedPlaces'][0]['name'], '舍利塔')
        self.assertEqual(result['stayMinutes']['pagoda'], 30)
        self.assertEqual(result['recentQuestions'], ['我想听历史'])
        self.assertEqual(result['routeStatus'], 'selection_only')
        self.assertFalse(result['locationAvailable'])
        self.assertNotIn('token', str(result).lower())

    def test_ended_demo_does_not_return_old_data(self):
        self.assertEqual(self.invoke({'active': False})['active'], False)
        self.assertNotIn('selectedPlaces', self.invoke({'active': False}))

    def test_expired_malformed_or_oversized_data_fails(self):
        p = self.active()
        for bad in [dict(p, expiresAt=1), dict(p, selectedPlaces='bad'),
                    dict(p, active='true'), dict(p, recentQuestions=['x'*2001]),
                    dict(p, selectedPlaces=[{'id': 'a', 'name': 'b', 'order': 2}])]:
            self.assertFalse(self.invoke(bad)['success'])

    def test_network_errors_do_not_become_guesses(self):
        with patch.dict(os.environ, {'QIXIA_DEMO_READ_TOKEN': 'x'*64}), patch('qixia_demo.build_opener', side_effect=OSError):
            self.assertEqual(get_current_demo_trip()['status'], 'demo_backend_unavailable')

    def test_external_destination_is_not_sent_the_read_token(self):
        with patch.dict(os.environ, {'QIXIA_DEMO_API': 'https://example.com/api/demo-trip/current'}):
            with patch('qixia_demo.build_opener') as opener:
                self.assertEqual(get_current_demo_trip()['status'], 'demo_config_invalid')
                opener.assert_not_called()

if __name__ == '__main__':
    unittest.main()

import io
import os

os.environ["YOLO_AUTOINSTALL"] = "false"
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image
import numpy as np
from ultralytics.engine.results import Results

from app import config
from app.detector import Analysis, Detection, Detector, all_detections, summarize
from app.main import app, detector


def note(name='20_nuevo', confidence=.9, bbox=None, edge=False):
    return Detection(name, confidence, bbox or [20, 20, 100, 100], edge)


class CountingTests(unittest.TestCase):
    def setUp(self):
        self.detector = Detector()

    def summary(self, *detections):
        return summarize(self.detector, Analysis(None, 100, None, list(detections)))

    def test_repeated_and_mixed_denominations(self):
        result = self.summary(note(), note(bbox=[120, 20, 200, 100]),
                              note('500_viejo', bbox=[220, 20, 300, 100]))
        self.assertEqual(result['count'], 3)
        self.assertEqual(result['total'], 540)
        self.assertEqual(result['groups'][0], {'denomination': 20, 'count': 2, 'subtotal': 40})
        self.assertEqual(len(result['detections']), 3)

    def test_duplicate_across_classes(self):
        result = self.summary(note(), note('50_nuevo', .8, [21, 21, 101, 101]))
        self.assertEqual((result['count'], result['total']), (1, 20))

    def test_unknown_numeric_class_is_not_inferred(self):
        result = self.summary(note('billete_999'), note('20_otra', bbox=[120, 20, 200, 100]))
        self.assertFalse(result['success'])
        self.assertEqual(result['total'], 0)
        self.assertEqual(len(result['rejected_detections']), 2)

    def test_low_confidence_and_partial_are_excluded(self):
        for detection in [note(confidence=config.MIN_CONFIDENCE-.01), note(edge=True)]:
            with self.subTest(detection=detection):
                self.assertEqual(self.summary(detection)['count'], 0)

    def test_partial_total(self):
        result = self.summary(note(), note('50_nuevo', .3, [120, 20, 200, 100]))
        self.assertEqual(result['total'], 20)
        self.assertTrue(result['partial'])

    def test_empty(self):
        self.assertEqual(self.summary()['total'], 0)
        self.assertFalse(self.summary()['success'])

    def test_invalid_boxes_and_nan(self):
        result = self.summary(note(bbox=[100, 20, 20, 100]), note(confidence=float('nan')))
        self.assertEqual(result['count'], 0)

    def test_classifier_does_not_simulate_boxes(self):
        analysis = Analysis(note(), 100, None, [], 'classify')
        result = summarize(self.detector, analysis)
        self.assertEqual(result['error_code'], 'detector_required')
        self.assertIsNone(result['total'])

    def test_extracts_every_box_and_suppresses_duplicate(self):
        result = Results(np.zeros((400, 400, 3), dtype=np.uint8), path="photo.jpg",
                         names={0: '20_nuevo', 1: '50_nuevo'},
                         boxes=np.array([[20, 20, 100, 100, .95, 0],
                                         [21, 21, 101, 101, .8, 1],
                                         [120, 20, 200, 100, .9, 0]]))
        detections = all_detections(result, 400, 400)
        self.assertEqual(len(detections), 2)
        self.assertEqual(self.summary(*detections)['total'], 40)

    def test_foreign_currency_is_not_added_to_mxn(self):
        self.detector.class_map['USD_20'] = config.BanknoteClass(20, 'USD')
        self.assertEqual(self.summary(note('USD_20'))['total'], 0)

    def test_real_model_metadata_matches_mapping(self):
        actual = Detector()
        actual.load()
        self.assertTrue(actual.ready, actual.load_error)
        self.assertEqual(actual.model.task, 'detect')
        self.assertTrue(set(actual.class_names) <= set(actual.class_map))
        # Inferencia real vacía: verifica la extracción de cajas sin simular objetos.
        analysis = actual.analyze(Image.new('RGB', (320, 320), 'white'))
        self.assertEqual(analysis.task, 'detect')
        self.assertEqual(analysis.detections, [])


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        output = io.BytesIO()
        Image.new('RGB', (320, 320), 'white').save(output, format='PNG')
        self.photo = output.getvalue()

    def request(self, path):
        return self.client.post(path, files={'image': ('photo.png', self.photo, 'image/png')})

    def test_existing_endpoint_and_count(self):
        detection = note()
        analysis = Analysis(detection, 100, None, [detection])
        with patch.object(detector, 'model', object()), patch.object(detector, 'analyze', return_value=analysis):
            old = self.request('/api/identify').json()
            self.assertTrue(old['success'])
            self.assertEqual(old['prediction']['denomination'], 20)
            self.assertNotIn('total', old)
            for path in ['/api/count', '/api/identify?multiple=true']:
                result = self.request(path).json()
                self.assertEqual(result['total'], 20)
                self.assertEqual(result['count'], 1)
                self.assertEqual(result['detections'][0]['bbox'], detection.bbox)

    def test_classification_individual_still_works(self):
        analysis = Analysis(Detection('20_nuevo', .9, None, False), 100, None, [], 'classify')
        with patch.object(detector, 'model', object()), patch.object(detector, 'analyze', return_value=analysis):
            self.assertTrue(self.request('/api/identify').json()['success'])
            self.assertEqual(self.request('/api/count').json()['error_code'], 'detector_required')

    def test_invalid_image(self):
        with patch.object(detector, 'model', object()):
            response = self.client.post('/api/count', files={'image': ('bad.png', b'invalid', 'image/png')})
            self.assertEqual(response.status_code, 422)


if __name__ == '__main__':
    unittest.main()

"""Inferencia con el modelo YOLO entrenado en Colab.

Funciona tanto con modelos de detección (cajas) como de clasificación
(probabilidades por clase): se detecta automáticamente según el resultado.
"""

import base64
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageOps
from ultralytics import YOLO

from . import config


@dataclass
class Detection:
    model_class: str
    confidence: float
    bbox: list[float] | None  # [x1, y1, x2, y2] en píxeles de la imagen recibida
    touches_edge: bool


@dataclass
class Analysis:
    detection: Detection | None
    blur_score: float
    annotated_jpeg_b64: str | None


class Detector:
    def __init__(self) -> None:
        self.model: YOLO | None = None
        self.load_error: str | None = None
        self.class_map = config.load_class_map()

    def load(self) -> None:
        if not config.MODEL_PATH.exists():
            self.load_error = f"No se encontró el modelo en {config.MODEL_PATH}"
            return
        try:
            self.model = YOLO(str(config.MODEL_PATH))
        except Exception as exc:  # pesos corruptos o versión incompatible
            self.load_error = f"No se pudo cargar el modelo: {exc}"

    @property
    def ready(self) -> bool:
        return self.model is not None

    @property
    def class_names(self) -> list[str]:
        return list(self.model.names.values()) if self.model else []

    def describe(self, model_class: str) -> config.BanknoteClass | None:
        return self.class_map.get(model_class) or config.parse_class_name(model_class)

    def analyze(self, image: Image.Image) -> Analysis:
        assert self.model is not None
        image = ImageOps.exif_transpose(image).convert("RGB")
        bgr = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)
        blur_score = blur_variance(bgr)

        result = self.model.predict(bgr, conf=config.DETECTION_CONFIDENCE, verbose=False)[0]
        detection = best_detection(result, bgr.shape[1], bgr.shape[0])

        annotated = None
        if config.RETURN_ANNOTATED and detection and detection.bbox:
            ok, buffer = cv2.imencode(".jpg", result.plot(), [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok:
                annotated = base64.b64encode(buffer.tobytes()).decode("ascii")

        return Analysis(detection, blur_score, annotated)


def blur_variance(bgr: np.ndarray) -> float:
    """Varianza del Laplaciano: valores bajos indican una imagen borrosa."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    scale = 800 / max(gray.shape)
    if scale < 1:  # medir siempre a una escala similar
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def best_detection(result, width: int, height: int) -> Detection | None:
    names = result.names

    # Modelo de clasificación
    if result.probs is not None:
        idx = int(result.probs.top1)
        return Detection(names[idx], float(result.probs.top1conf), None, False)

    # Modelo de detección: la caja con mayor confianza
    boxes = result.boxes
    if boxes is None or len(boxes) == 0:
        return None
    i = int(boxes.conf.argmax())
    x1, y1, x2, y2 = (float(v) for v in boxes.xyxy[i].tolist())
    margin = 0.01 * max(width, height)
    touches_edge = x1 <= margin or y1 <= margin or x2 >= width - margin or y2 >= height - margin
    return Detection(names[int(boxes.cls[i])], float(boxes.conf[i]), [x1, y1, x2, y2], touches_edge)

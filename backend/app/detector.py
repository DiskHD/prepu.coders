"""Inferencia con el modelo YOLO entrenado en Colab.

Funciona tanto con modelos de detección (cajas) como de clasificación
(probabilidades por clase): se detecta automáticamente según el resultado.
"""

import base64
from dataclasses import dataclass, field
import math

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
    detections: list[Detection] = field(default_factory=list)
    task: str = "detect"


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

        result = self.model.predict(bgr, conf=config.DETECTION_CONFIDENCE, iou=config.NMS_IOU, agnostic_nms=True, verbose=False)[0]
        detection = best_detection(result, bgr.shape[1], bgr.shape[0])

        annotated = None
        if config.RETURN_ANNOTATED and detection and detection.bbox:
            ok, buffer = cv2.imencode(".jpg", result.plot(), [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok:
                annotated = base64.b64encode(buffer.tobytes()).decode("ascii")

        return Analysis(detection, blur_score, annotated, all_detections(result, bgr.shape[1], bgr.shape[0]),
                        "classify" if result.probs is not None else "detect")


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


def box_iou(a: list[float], b: list[float]) -> float:
    intersection = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    union = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - intersection
    return intersection / union if union > 0 else 0


def suppress_duplicates(detections: list[Detection]) -> list[Detection]:
    """NMS independiente de clase: dos etiquetas sobre una caja no son dos billetes."""
    kept = []
    for det in sorted(detections, key=lambda d: d.confidence, reverse=True):
        if not det.bbox or not all(math.isfinite(v) for v in [det.confidence, *det.bbox]):
            continue
        if det.bbox[2] <= det.bbox[0] or det.bbox[3] <= det.bbox[1]:
            continue
        if all(box_iou(det.bbox, other.bbox) <= config.NMS_IOU for other in kept):
            kept.append(det)
    return kept


def all_detections(result, width: int, height: int) -> list[Detection]:
    if result.probs is not None or result.boxes is None:
        return []
    margin = 0.01 * max(width, height)
    detections = []
    for box in result.boxes:
        x1, y1, x2, y2 = map(float, box.xyxy[0].tolist())
        detections.append(Detection(result.names[int(box.cls[0])], float(box.conf[0]),
                                    [x1, y1, x2, y2],
                                    x1 <= margin or y1 <= margin or x2 >= width-margin or y2 >= height-margin))
    return suppress_duplicates(detections)


def summarize(detector: Detector, analysis: Analysis) -> dict:
    """Suma únicamente detecciones confiables con correspondencia explícita MXN."""
    if analysis.task != "detect":
        return {"success": False, "prediction": None, "error_code": "detector_required",
                "message": "El modelo es de clasificación. Se necesita un modelo de detección para contar billetes.",
                "detections": [], "count": 0, "total": None, "currency": "MXN", "groups": []}
    accepted, rejected, groups = [], [], {}
    for det in suppress_duplicates(analysis.detections):
        info = detector.class_map.get(det.model_class)
        reason = None
        if info is None or info.currency != "MXN" or info.denomination not in {20, 50, 100, 200, 500, 1000}:
            reason = "unknown_class"
        elif det.confidence < config.MIN_CONFIDENCE:
            reason = "low_confidence"
        elif det.touches_edge:
            reason = "partial_banknote"
        item = {"class": det.model_class, "confidence": round(det.confidence, 4), "bbox": det.bbox}
        if reason:
            rejected.append({**item, "reason": reason})
            continue
        item.update(denomination=info.denomination, currency="MXN")
        accepted.append(item)
        groups[info.denomination] = groups.get(info.denomination, 0) + 1
    total = sum(d["denomination"] for d in accepted)
    message = f"Se identificaron {len(accepted)} billetes. Total: {total} pesos mexicanos."
    if rejected:
        message += f" Se excluyeron {len(rejected)} detecciones dudosas o sin denominación; el total puede ser parcial."
    return {"success": bool(accepted), "prediction": accepted[0] if accepted else None,
            "detections": accepted, "count": len(accepted), "total": total, "currency": "MXN",
            "groups": [{"denomination": value, "count": count, "subtotal": value*count}
                       for value, count in sorted(groups.items())],
            "rejected_detections": rejected, "partial": bool(rejected),
            "message": message if accepted else "No hay billetes mexicanos con suficiente confianza para sumar.",
            **({} if accepted else {"error_code": "no_detection"})}

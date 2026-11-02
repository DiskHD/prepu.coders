"""Configuración del backend. Todo se puede cambiar con variables de entorno."""

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Pesos exportados desde Colab; por convención del equipo viven en <raíz>/models/best.pt.
MODEL_PATH = Path(os.getenv("MODEL_PATH", BASE_DIR.parent / "models" / "best.pt"))
# Archivo opcional que traduce cada clase del modelo a denominación y moneda.
CLASSES_PATH = Path(os.getenv("CLASSES_PATH", BASE_DIR / "classes.json"))
# Moneda que se asume cuando la clase no la indica (p. ej. "200_pesos").
DEFAULT_CURRENCY = os.getenv("DEFAULT_CURRENCY", "MXN")

# Confianza mínima que YOLO necesita para considerar una detección.
DETECTION_CONFIDENCE = float(os.getenv("DETECTION_CONFIDENCE", "0.25"))
# Por debajo de este valor se responde low_confidence en lugar de un resultado.
MIN_CONFIDENCE = float(os.getenv("MIN_CONFIDENCE", "0.6"))
# Varianza del Laplaciano por debajo de la cual la foto se considera borrosa.
BLUR_THRESHOLD = float(os.getenv("BLUR_THRESHOLD", "60"))
# Devolver la imagen con la detección dibujada (aumenta el tamaño de la respuesta).
RETURN_ANNOTATED = os.getenv("RETURN_ANNOTATED", "1") == "1"

# Orígenes permitidos por CORS (separados por comas). En desarrollo el proxy de
# Vite hace innecesario CORS, pero sirve si el frontend se publica aparte.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

CURRENCY_HINTS = {
    "peso": "MXN",
    "mxn": "MXN",
    "dolar": "USD",
    "dollar": "USD",
    "usd": "USD",
    "euro": "EUR",
    "eur": "EUR",
}


@dataclass(frozen=True)
class BanknoteClass:
    denomination: int
    currency: str


def load_class_map() -> dict[str, BanknoteClass]:
    """Lee classes.json: {"200_pesos": {"denomination": 200, "currency": "MXN"}, ...}."""
    if not CLASSES_PATH.exists():
        return {}
    data = json.loads(CLASSES_PATH.read_text(encoding="utf-8"))
    return {name: BanknoteClass(int(v["denomination"]), str(v["currency"]).upper()) for name, v in data.items()}


def parse_class_name(name: str) -> BanknoteClass | None:
    """Deduce denominación y moneda del nombre de la clase, p. ej. "200_pesos" o "USD_20"."""
    match = re.search(r"\d+", name)
    if not match:
        return None
    lowered = name.lower()
    currency = next((code for hint, code in CURRENCY_HINTS.items() if hint in lowered), DEFAULT_CURRENCY)
    return BanknoteClass(int(match.group()), currency)

# Umbral IoU para NMS independiente de clase.
NMS_IOU = float(os.getenv("NMS_IOU", "0.5"))

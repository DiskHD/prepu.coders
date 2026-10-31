"""API de Billete al Tiro: recibe una foto y devuelve el billete identificado por YOLO."""

import io
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from . import config
from .detector import Detector

CURRENCY_NAMES = {"MXN": "pesos mexicanos", "USD": "dólares estadounidenses", "EUR": "euros"}
MAX_UPLOAD_BYTES = 15 * 1024 * 1024

detector = Detector()


@asynccontextmanager
async def lifespan(_: FastAPI):
    detector.load()
    if detector.ready:
        print(f"Modelo cargado: {config.MODEL_PATH}")
        print(f"Clases del modelo: {detector.class_names}")
        for name in detector.class_names:
            if detector.describe(name) is None:
                print(f"  AVISO: no se sabe qué billete es la clase '{name}'. Añádela a classes.json.")
    else:
        print(f"AVISO: {detector.load_error}")
    yield


app = FastAPI(title="Billete al Tiro API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])


def failure(message: str, error_code: str, prediction: dict | None = None) -> dict:
    return {"success": False, "prediction": prediction, "message": message, "error_code": error_code}


@app.get("/api/health")
def health():
    if not detector.ready:
        return JSONResponse(status_code=503, content={"status": "error", "detail": detector.load_error})
    return {"status": "ok", "model": config.MODEL_PATH.name, "classes": detector.class_names}


@app.post("/api/identify")
async def identify(image: UploadFile = File(...)):
    if not detector.ready:
        raise HTTPException(status_code=503, detail=detector.load_error)

    data = await image.read()
    if len(data) > MAX_UPLOAD_BYTES:
        return JSONResponse(status_code=413, content=failure("La imagen es demasiado grande", "invalid_image"))
    try:
        pil_image = Image.open(io.BytesIO(data))
        pil_image.load()
    except (UnidentifiedImageError, OSError):
        return JSONResponse(status_code=422, content=failure("El archivo no es una imagen válida", "invalid_image"))

    analysis = await run_in_threadpool(detector.analyze, pil_image)
    det = analysis.detection

    if det is None:
        if analysis.blur_score < config.BLUR_THRESHOLD:
            return failure("La imagen está borrosa", "blurry_image")
        return failure("No se pudo identificar el billete", "no_detection")

    info = detector.describe(det.model_class)
    if info is None:
        # La clase existe en el modelo pero no sabemos a qué billete corresponde.
        return failure(f"Clase '{det.model_class}' sin denominación configurada", "no_detection")

    prediction = {
        "class": det.model_class,
        "denomination": info.denomination,
        "currency": info.currency,
        "confidence": round(det.confidence, 4),
    }
    if det.bbox:
        prediction["bbox"] = [round(v, 1) for v in det.bbox]

    if det.confidence < config.MIN_CONFIDENCE:
        if analysis.blur_score < config.BLUR_THRESHOLD:
            return failure("La imagen está borrosa", "blurry_image", prediction)
        if det.touches_edge:
            return failure("El billete no se ve completo", "partial_banknote", prediction)
        return failure("Confianza insuficiente", "low_confidence", prediction)

    currency_name = CURRENCY_NAMES.get(info.currency, info.currency)
    response = {
        "success": True,
        "prediction": prediction,
        "message": f"Billete de {info.denomination} {currency_name} identificado",
    }
    if analysis.annotated_jpeg_b64:
        response["annotated_image"] = analysis.annotated_jpeg_b64
    return response

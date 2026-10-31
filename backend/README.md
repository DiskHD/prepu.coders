# Billete al Tiro — Backend (FastAPI + YOLO)

Carga el modelo entrenado en Google Colab y expone `POST /api/identify` y `GET /api/health`,
con el contrato que espera el frontend.

## 1. Descargar el modelo desde Colab

Al final del notebook de entrenamiento, ejecuta en una celda:

```python
from google.colab import files
files.download('/content/runs/detect/train/weights/best.pt')
```

- Si reentrenaste varias veces, la carpeta puede ser `train2`, `train3`… Búscala con `!ls /content/runs/*/`.
- Si es un modelo de **clasificación**, la ruta es `runs/classify/train/weights/best.pt`.
- Si guardaste en Google Drive, descarga `best.pt` desde ahí.

Copia el archivo a `backend/models/best.pt`.

## 2. Revisar los nombres de las clases

En Colab:

```python
from ultralytics import YOLO
print(YOLO('/content/runs/detect/train/weights/best.pt').names)
```

Si las clases incluyen el número (`200_pesos`, `billete_500`, `USD_20`…), el backend deduce la
denominación solo; la moneda por defecto es `MXN` (cámbiala con `DEFAULT_CURRENCY`).
Si no (p. ej. `frida_kahlo`), copia `classes.example.json` a `classes.json` y ajústalo:

```json
{ "frida_kahlo": { "denomination": 500, "currency": "MXN" } }
```

Al arrancar, el servidor imprime las clases y avisa de las que no sabe interpretar.

## 3. Instalar y ejecutar

```bash
sudo apt install python3.12-venv      # solo si python3 -m venv falla
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --extra-index-url https://download.pytorch.org/whl/cpu torch torchvision   # PyTorch sin GPU (más ligero)
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

En otra terminal: `cd frontend && npm run dev` (o `npm run dev:https` para el teléfono).
El frontend redirige `/api` a `http://localhost:8000`, así que no hay que configurar nada más.

Comprobar: http://localhost:8000/api/health debe responder `{"status": "ok", ...}` y
http://localhost:8000/docs permite probar `/api/identify` subiendo una foto.

## Ajustes (variables de entorno)

| Variable | Por defecto | Qué hace |
|---|---|---|
| `MODEL_PATH` | `models/best.pt` | Ruta de los pesos |
| `CLASSES_PATH` | `classes.json` | Mapa clase → denominación/moneda |
| `DEFAULT_CURRENCY` | `MXN` | Moneda si la clase no la indica |
| `DETECTION_CONFIDENCE` | `0.25` | Umbral de YOLO para considerar una detección |
| `MIN_CONFIDENCE` | `0.6` | Por debajo, responde `low_confidence` |
| `BLUR_THRESHOLD` | `60` | Varianza del Laplaciano bajo la cual la foto es borrosa |
| `RETURN_ANNOTATED` | `1` | Devolver la imagen con la caja dibujada |
| `CORS_ORIGINS` | `*` | Orígenes permitidos si el frontend se sirve aparte |

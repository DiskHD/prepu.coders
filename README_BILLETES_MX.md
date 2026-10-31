# Reconocimiento de billetes mexicanos con YOLO11n

Proyecto de asistencia para personas con discapacidad visual. Detecta denominaciones de billetes mexicanos en fotografías y comunica el resultado mediante voz. **No verifica autenticidad.**

## 1. Arquitectura

```text
Roboflow (dataset billetes-mx, versión 3)
       ↓
Google Colab (entrenamiento YOLO11n)
       ↓
models/best.pt
       ↓
FastAPI (inferencia)
       ↓
Frontend HTML/CSS/JS (cámara y voz)
```

**Responsabilidades:** quien entrena prepara y evalúa el dataset, conserva las métricas y publica el modelo; quien implementa desarrolla la API, el frontend accesible y las pruebas de integración.

## 2. Requisitos

- Python 3.11 recomendado.
- Cuenta de Roboflow con acceso al proyecto `derick-fernandez/billetes-mx`, versión 3.
- Google Colab, preferentemente con GPU T4 disponible.
- Git y acceso al repositorio `https://github.com/DiskHD/prepu.coders.git`.

> **Seguridad:** nunca publiques claves API en notebooks, commits, capturas o README. Si una clave fue compartida, revócala y genera otra. En Colab usa **Secrets** con el nombre `ROBOFLOW_API_KEY`.

## 3. Entrenamiento en Google Colab

### 3.1 Activar GPU

En Colab: **Entorno de ejecución → Cambiar tipo de entorno de ejecución → GPU T4** (si está disponible). Comprobar:

```python
import torch
print('CUDA disponible:', torch.cuda.is_available())
if torch.cuda.is_available():
    print('GPU:', torch.cuda.get_device_name(0))
```

### 3.2 Instalar dependencias

```python
!pip install -q roboflow ultralytics pyyaml
```

### 3.3 Obtener el dataset de Roboflow

No hace falta descargarlo a la computadora ni subirlo a Google Drive: la API lo transfiere al almacenamiento **temporal** de Colab.

```python
from google.colab import userdata
from roboflow import Roboflow
from pathlib import Path

rf = Roboflow(api_key=userdata.get('ROBOFLOW_API_KEY'))
project = rf.workspace('derick-fernandez').project('billetes-mx')
version = project.version(3)
dataset = version.download('yolov11', location='/content/billetes-mx')
data_yaml = str(Path(dataset.location) / 'data.yaml')
print('Dataset:', dataset.location)
print('Configuración:', data_yaml)
```

> Si la versión del SDK no admite el formato solicitado, comprueba las opciones de exportación de esa versión de Roboflow. La descarga sigue siendo necesaria **dentro de Colab** para entrenar YOLO localmente.

### 3.4 Revisar las clases

```python
import yaml
with open(data_yaml, encoding='utf-8') as f:
    config = yaml.safe_load(f)
print('Clases:', config['names'])
print('Número de clases:', config['nc'])
```

Verifica que cada etiqueta corresponde a la denominación correcta. Revisa que las imágenes de validación y prueba no sean duplicados o tomas casi idénticas a las de entrenamiento.

### 3.5 Entrenamiento de prueba

```python
from ultralytics import YOLO
import torch

device = 0 if torch.cuda.is_available() else 'cpu'
YOLO('yolo11n.pt').train(data=data_yaml, epochs=5, imgsz=640, batch=8, device=device,
                          project='/content/resultados_billetes', name='prueba')
```

### 3.6 Entrenamiento principal

```python
modelo = YOLO('yolo11n.pt')
modelo.train(
    data=data_yaml,
    epochs=100,
    imgsz=640,
    batch=8,
    patience=20,
    device=device,
    project='/content/resultados_billetes',
    name='modelo_v1',
    plots=True
)
```

Si la memoria de GPU se agota, reduce `batch` a 4 o `imgsz` a 512. La disponibilidad de GPU gratuita en Colab no está garantizada.

### 3.7 Evaluar y conservar resultados

```python
from pathlib import Path
ruta_modelo = Path('/content/resultados_billetes/modelo_v1/weights/best.pt')
assert ruta_modelo.exists(), 'No se encontró best.pt; revisa la carpeta de resultados.'
modelo_final = YOLO(str(ruta_modelo))
print('Clases entrenadas:', modelo_final.names)

# Ejecutar sobre el conjunto de prueba si está definido en data.yaml
metricas = modelo_final.val(data=data_yaml, split='test')
print('mAP50:', metricas.box.map50)
print('mAP50-95:', metricas.box.map)
```

Si el dataset no incluye `test`, usa `split='val'` e indícalo en el reporte. Conserva `results.png`, `confusion_matrix.png`, métricas por clase, ejemplos de errores y las versiones de dependencias. La confianza del detector no es una probabilidad de acierto calibrada.

### 3.8 Exportar o descargar el modelo

```python
from google.colab import files
files.download(str(ruta_modelo))
# Opcional: exportar ONNX para otras plataformas
modelo_final.export(format='onnx', imgsz=640)
```

Colab puede borrar los archivos temporales al finalizar la sesión. Guarda `best.pt` y el reporte fuera del entorno antes de desconectarte. Google Drive es opcional.

## 4. Organización propuesta del repositorio

```text
prepu.coders/
├── entrenamiento/
│   ├── entrenamiento_billetes.ipynb
│   └── README.md
├── models/
│   └── best.pt
├── backend/
│   ├── __init__.py
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── pruebas/
│   └── resultados.md
├── .gitignore
└── README.md
```

Es una estructura sugerida; ajústala a los archivos existentes sin sobrescribir trabajo de otras personas. **No subas el dataset completo ni secretos.** Si el modelo supera los límites de GitHub, utiliza Git LFS o un Release y documenta cómo obtenerlo.

Ejemplo de `.gitignore`:

```gitignore
.venv/
__pycache__/
*.pyc
.env
.env.*
!*.example
runs/
datasets/
*.zip
.ipynb_checkpoints/
```

## 5. Publicar el modelo en GitHub (responsable del entrenamiento)

```bash
git clone https://github.com/DiskHD/prepu.coders.git
cd prepu.coders
git checkout -b feature/entrenamiento-ia
mkdir -p models entrenamiento pruebas
```

Copia el `best.pt` descargado a `models/best.pt`, incorpora el notebook **sin credenciales** y registra métricas y clases reales en `pruebas/resultados.md`.

```bash
git add models/ entrenamiento/ pruebas/
git commit -m "Agregar modelo YOLO11n entrenado y evaluación"
git push -u origin feature/entrenamiento-ia
```

Crea un **pull request** hacia `main`. Si tu rama ya existe, úsala en lugar de crearla de nuevo. El colaborador puede revisar y fusionar el PR.

## 6. Ejecutar el modelo sin reentrenar (colaborador)

### 6.1 Clonar e instalar

```bash
git clone https://github.com/DiskHD/prepu.coders.git
cd prepu.coders
python -m venv .venv
```

Activar entorno:

- Linux/macOS: `source .venv/bin/activate`
- Windows PowerShell: `.venv\Scripts\Activate.ps1`

Archivo `backend/requirements.txt`:

```text
ultralytics
fastapi
uvicorn
python-multipart
opencv-python-headless
```

Instalar desde la raíz:

```bash
pip install -r backend/requirements.txt
```

Para reproducibilidad, registrar y fijar las versiones que se hayan probado antes de entregar.

### 6.2 Probar una imagen

```python
from ultralytics import YOLO

modelo = YOLO('models/best.pt')
print('Clases:', modelo.names)
resultados = modelo.predict('billete_prueba.jpg', conf=0.60, save=True)
for resultado in resultados:
    for caja in resultado.boxes:
        clase = int(caja.cls[0])
        confianza = float(caja.conf[0])
        print(modelo.names[clase], f'{confianza:.1%}')
```

El archivo `billete_prueba.jpg` debe existir en la raíz o modificarse su ruta. No asumas que los nombres de clases son `billete_200`: usa `modelo.names`.

### 6.3 Backend con FastAPI

Crear `backend/__init__.py` vacío y `backend/main.py`:

```python
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException
from ultralytics import YOLO
import numpy as np
import cv2

app = FastAPI(title='Reconocimiento de billetes MX')
ROOT = Path(__file__).resolve().parent.parent
modelo = YOLO(str(ROOT / 'models' / 'best.pt'))

@app.post('/reconocer')
async def reconocer(file: UploadFile = File(...)):
    if file.content_type not in {'image/jpeg', 'image/png'}:
        raise HTTPException(status_code=400, detail='Formato no permitido')
    contenido = await file.read()
    if len(contenido) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail='Imagen demasiado grande')
    imagen = cv2.imdecode(np.frombuffer(contenido, dtype=np.uint8), cv2.IMREAD_COLOR)
    if imagen is None:
        raise HTTPException(status_code=400, detail='Imagen inválida')
    resultados = modelo.predict(imagen, conf=0.60, verbose=False)
    billetes = [
        {'denominacion': modelo.names[int(c.cls[0])],
         'confianza': round(float(c.conf[0]), 3)}
        for c in resultados[0].boxes
    ]
    return {'detectado': bool(billetes), 'billetes': billetes}
```

Ejecutar desde la raíz:

```bash
uvicorn backend.main:app --reload
```

Probar en `http://127.0.0.1:8000/docs` o con:

```bash
curl -F 'file=@billete_prueba.jpg' http://127.0.0.1:8000/reconocer
```

Ejemplo de respuesta (ilustrativo):

```json
{
  "detectado": true,
  "billetes": [{"denominacion": "billete_200", "confianza": 0.94}]
}
```

### 6.4 Frontend mínimo y accesible

Crear `frontend/index.html`:

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reconocimiento de billetes mexicanos</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main>
    <h1>Reconocer billete</h1>
    <label for="foto">Toma una foto o selecciona una imagen</label>
    <input id="foto" type="file" accept="image/*" capture="environment">
    <button id="reconocer">Reconocer billete</button>
    <p id="resultado" role="status" aria-live="polite">Esperando imagen.</p>
    <button id="repetir">Repetir resultado</button>
  </main>
  <script src="app.js"></script>
</body>
</html>
```

Crear `frontend/styles.css`:

```css
body { font-family: system-ui, sans-serif; margin: 0; background: #101820; color: white; }
main { max-width: 32rem; margin: auto; padding: 2rem 1rem; }
input, button { display: block; margin: 1rem 0; width: 100%; box-sizing: border-box; }
button { min-height: 3.5rem; font-size: 1.15rem; cursor: pointer; }
:focus-visible { outline: 3px solid #ffd34d; outline-offset: 3px; }
```

Crear `frontend/app.js`:

```javascript
const foto = document.getElementById('foto');
const salida = document.getElementById('resultado');
const boton = document.getElementById('reconocer');
let ultimoMensaje = '';

function hablar(texto) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const voz = new SpeechSynthesisUtterance(texto);
  voz.lang = 'es-MX';
  voz.rate = 0.9;
  speechSynthesis.speak(voz);
}

boton.addEventListener('click', async () => {
  if (!foto.files.length) {
    salida.textContent = 'Selecciona una imagen primero.';
    hablar(salida.textContent);
    return;
  }
  boton.disabled = true;
  salida.textContent = 'Analizando imagen...';
  try {
    const form = new FormData();
    form.append('file', foto.files[0]);
    const response = await fetch('/reconocer', { method: 'POST', body: form });
    if (!response.ok) throw new Error('Error al analizar la imagen');
    const data = await response.json();
    if (!data.detectado) {
      ultimoMensaje = 'No se identificó el billete. Intenta con mejor iluminación.';
    } else if (data.billetes.length !== 1) {
      ultimoMensaje = 'Se detectaron varios billetes. Coloca uno solo frente a la cámara.';
    } else {
      // Adaptar a los nombres REALES de las clases del modelo.
      const clase = data.billetes[0].denominacion;
      ultimoMensaje = `Billete identificado: ${clase}`;
    }
    salida.textContent = ultimoMensaje;
    hablar(ultimoMensaje);
  } catch (error) {
    ultimoMensaje = 'No fue posible analizar la imagen. Intenta de nuevo.';
    salida.textContent = ultimoMensaje;
    hablar(ultimoMensaje);
  } finally {
    boton.disabled = false;
  }
});

document.getElementById('repetir').addEventListener('click', () => {
  if (ultimoMensaje) hablar(ultimoMensaje);
});
```

**Importante:** el ejemplo usa `fetch('/reconocer')`, que requiere servir frontend y backend desde el **mismo origen** (por ejemplo, montando archivos estáticos en FastAPI o mediante un proxy). Abrir `index.html` directamente como archivo local no basta. Una alternativa es usar una URL absoluta para la API y configurar CORS de manera restrictiva. Para acceder a la cámara desde un navegador móvil, normalmente se necesita HTTPS; el atributo `capture` abre la cámara o selector compatible, pero su comportamiento depende del navegador.

La aplicación final debe traducir los nombres de clase a frases naturales, manejar imágenes con varias detecciones y avisar si no hay suficiente confianza. El umbral `0.60` es provisional y debe ajustarse con validación real.

## 7. Flujo de trabajo en equipo

1. El responsable del entrenamiento sube notebook, `best.pt`, lista de clases y métricas a `feature/entrenamiento-ia`.
2. El colaborador desarrolla API y frontend en `feature/aplicacion-web`.
3. Ambos crean pull requests, revisan cambios y fusionan a `main`.
4. El colaborador ejecuta pruebas con fotografías nuevas sin reentrenar.
5. Ambos documentan resultados, errores y limitaciones.

Ejemplo para la rama del colaborador:

```bash
git checkout main
git pull origin main
git checkout -b feature/aplicacion-web
# Crear los archivos de frontend y backend
git add frontend/ backend/
git commit -m "Implementar API y frontend accesible"
git push -u origin feature/aplicacion-web
```

## 8. Criterios de prueba

- Evaluar todas las denominaciones realmente incluidas en el dataset.
- Fotografiar ambas caras, distintos ángulos, distancias, fondos y niveles de luz.
- Registrar falsos positivos, confusiones entre denominaciones y rechazos.
- Medir precisión por clase, recall, matriz de confusión y latencia.
- Probar con un billete, varios billetes y escenas sin billetes.
- Confirmar que la voz funciona y puede repetirse.
- Verificar accesibilidad con teclado, lector de pantalla y controles táctiles grandes.
- Validar con personas usuarias, con su consentimiento, antes de afirmar que es apta para uso cotidiano.

**Advertencia:** el reconocimiento de denominación no verifica la autenticidad del billete. Ante predicciones ambiguas, la aplicación debe pedir otra foto en vez de anunciar un valor como seguro.

## 9. Fuentes y documentación

- [Repositorio del proyecto](https://github.com/DiskHD/prepu.coders)
- [Google Colab](https://colab.research.google.com/)
- [Roboflow](https://roboflow.com/)
- [Documentación Ultralytics YOLO11](https://docs.ultralytics.com/models/yolo11/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Banco de México](https://www.banxico.org.mx/)

Antes de redistribuir imágenes o modelos, revisar las licencias del dataset de Roboflow y de Ultralytics, especialmente si el proyecto se publicará o comercializará.

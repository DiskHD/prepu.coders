# Billete al Tiro

Aplicación web que ayuda a personas ciegas o con discapacidad visual a identificar billetes mexicanos. El usuario fotografía un billete con la cámara del teléfono, un modelo **YOLO11n** lo reconoce en un servidor Python y la aplicación anuncia el resultado en voz alta:

> «Se ha identificado un billete de 200 pesos mexicanos. Nivel de confianza: 98 por ciento.»

Toda la aplicación se puede usar sin ver la pantalla: funciona con lector de pantalla (TalkBack, VoiceOver, NVDA), con voz propia, con teclado y con controles táctiles grandes.

> **Advertencia:** Billete al Tiro reconoce la **denominación**, no verifica que el billete sea **auténtico**.

---

## Índice

1. [Cómo funciona](#1-cómo-funciona) · [Tecnologías](#tecnologías)
2. [Estructura del repositorio](#2-estructura-del-repositorio)
3. [Ejecutar el proyecto en cualquier computadora](#3-ejecutar-el-proyecto-en-cualquier-computadora)
4. [Probar en el teléfono](#4-probar-en-el-teléfono)
5. [El modelo](#5-el-modelo)
6. [Entrenamiento en Google Colab](#6-entrenamiento-en-google-colab)
7. [API del backend](#7-api-del-backend)
8. [Frontend y accesibilidad](#8-frontend-y-accesibilidad)
9. [Configuración](#9-configuración)
10. [Solución de problemas](#10-solución-de-problemas)
11. [Flujo de trabajo en equipo](#11-flujo-de-trabajo-en-equipo)
12. [Criterios de prueba](#12-criterios-de-prueba)
13. [Fuentes y licencias](#13-fuentes-y-licencias)

---

## 1. Cómo funciona

```text
Roboflow (dataset billetes-mx, versión 3)
       ↓
Google Colab (entrenamiento YOLO11n)
       ↓
models/best.pt
       ↓
Backend: FastAPI + Ultralytics + OpenCV  (puerto 8000)
       ↑  POST /api/identify (foto)   ↓  JSON (denominación, confianza)
Frontend: React + TypeScript + Tailwind  (puerto 5173)
       ↓
Cámara del teléfono · Voz (Web Speech API) · Lector de pantalla
```

- El reconocimiento se ejecuta **solo en Python**. El frontend nunca inventa resultados: si el servidor no responde, lo dice («el reconocimiento real todavía no está disponible»).
- En desarrollo, Vite redirige las peticiones `/api` del frontend al backend en `http://localhost:8000`, así que no hace falta configurar CORS ni URLs.

### Tecnologías

**Frontend (la página web)**

- **React** (18.3) con **TypeScript** (5.6): la interfaz y su lógica.
- **Vite** (5.4): el servidor de desarrollo y la compilación.
- **Tailwind CSS** (4.1): los estilos.
- **Lucide React**: los iconos.
- APIs del propio navegador:
  - **Web Speech API** para la voz;
  - **MediaDevices API** para la cámara;
  - **Web Audio API** para los tonos;
  - **Vibration API** para la vibración.

**Backend (el servidor)**

- **Python** con **FastAPI** (0.115): la API que recibe la foto y devuelve el resultado.
- **Uvicorn** (0.32): el servidor que ejecuta FastAPI.
- **Ultralytics YOLO11n** (8.4.195, sobre **PyTorch**): el modelo que reconoce el billete.
- **OpenCV**: detecta si la foto está borrosa y dibuja la caja sobre el billete.
- **Pillow**: abre la imagen y corrige su orientación.

**Cómo se comunican:** el frontend envía la foto al backend por **HTTP** (API REST, `POST /api/identify`, en formato `multipart/form-data`) y el backend responde en **JSON**.

Las versiones exactas están en `frontend/package.json` y `backend/requirements.txt`.

## 2. Estructura del repositorio

```text
prepu.coders/
├── models/
│   └── best.pt                 # Modelo entrenado en Colab (YOLO11n, 10 clases)
├── backend/                    # API en Python
│   ├── app/
│   │   ├── main.py             # Endpoints /api/identify y /api/health
│   │   ├── detector.py         # Inferencia YOLO, detección de desenfoque (OpenCV)
│   │   └── config.py           # Ajustes por variables de entorno
│   ├── classes.json            # Clase del modelo → denominación y moneda
│   ├── classes.example.json
│   ├── requirements.txt
│   └── README.md
├── frontend/                   # Aplicación web accesible
│   ├── src/
│   │   ├── components/         # Camera, CaptureButton, ResultCard, VoiceAssistant, LoadingIndicator…
│   │   ├── pages/              # Home, Identification, Settings
│   │   ├── services/           # api.ts (HTTP) e identificationService.ts (contrato con el backend)
│   │   ├── hooks/              # useCamera, useSpeech, useBackendStatus
│   │   ├── context/            # Configuración del usuario (voz, contraste, tamaño de texto)
│   │   ├── types/              # Tipos del contrato JSON y del dominio
│   │   └── utils/              # Textos hablados, tonos/vibración, reducción de imagen
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
├── README_BILLETES_MX.md       # Guía original de entrenamiento en Colab
└── README.md
```

## 3. Ejecutar el proyecto en cualquier computadora

Se necesitan **dos terminales**: una para el backend (Python) y otra para el frontend (Node.js).

### 3.1 Requisitos

| Programa | Versión | Comprobar | Descarga |
|---|---|---|---|
| Git | cualquiera | `git --version` | https://git-scm.com/downloads |
| Python | 3.10 o superior (3.11 recomendado) | `python --version` o `python3 --version` | https://www.python.org/downloads/ |
| Node.js | 18 o superior (incluye npm) | `node --version` | https://nodejs.org/ (versión LTS) |

No hace falta GPU: el modelo YOLO11n funciona bien en el procesador (CPU).

- **Windows:** al instalar Python, marca la casilla **«Add python.exe to PATH»**.
- **Ubuntu/Debian:** instala también el módulo de entornos virtuales: `sudo apt install python3-venv` (o `python3.12-venv` según tu versión).
- **macOS:** puedes instalar todo con Homebrew: `brew install git python node`.

### 3.2 Descargar el proyecto

```bash
git clone https://github.com/DiskHD/prepu.coders.git
cd prepu.coders
```

Comprueba que llegó el modelo: debe existir el archivo `models/best.pt` (unos 5.5 MB).

### 3.3 Terminal 1: backend (Python)

**Linux / macOS**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install --extra-index-url https://download.pytorch.org/whl/cpu torch torchvision
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Windows (PowerShell)**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install --extra-index-url https://download.pytorch.org/whl/cpu torch torchvision
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> Si PowerShell dice que «la ejecución de scripts está deshabilitada», ejecuta una vez
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y vuelve a activar el entorno.
> En `cmd.exe` la activación es `.venv\Scripts\activate.bat`.

La línea de `torch` instala PyTorch **solo para CPU** (mucho más ligero). Si tu computadora tiene GPU NVIDIA y quieres usarla, omite esa línea y `requirements.txt` instalará la versión estándar.

La primera instalación descarga varios cientos de MB. Al arrancar debe aparecer:

```text
Modelo cargado: .../prepu.coders/models/best.pt
Clases del modelo: ['1000_nuevo', '100_nuevo', '100_viejo', ...]
Uvicorn running on http://0.0.0.0:8000
```

Compruébalo en el navegador: http://localhost:8000/api/health debe responder `{"status": "ok", ...}`. En http://localhost:8000/docs puedes subir una foto a mano (`POST /api/identify` → *Try it out*).

Las siguientes veces solo hace falta:

```bash
cd backend
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3.4 Terminal 2: frontend (página web)

Igual en Linux, macOS y Windows:

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173**. En la pantalla de inicio debe aparecer «Servidor de reconocimiento conectado». Si dice que el reconocimiento no está disponible, el backend no está corriendo o no encontró el modelo (revisa la terminal 1).

`npm install` solo hace falta la primera vez o cuando cambie `package.json`.

### 3.5 Resumen de comandos

| Dónde | Comando | Para qué |
|---|---|---|
| `backend/` | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` | API con el modelo YOLO |
| `frontend/` | `npm run dev` | Página en http://localhost:5173 |
| `frontend/` | `npm run dev:https` | Página con HTTPS para probar la cámara en el teléfono |
| `frontend/` | `npm run build` | Revisa tipos y genera la versión de producción en `frontend/dist/` |
| `frontend/` | `npm run preview` | Sirve la versión de producción en http://localhost:4173 |

## 4. Probar en el teléfono

Los navegadores solo permiten usar la cámara en páginas **https** o en **localhost**. En el teléfono, `localhost` es el propio teléfono, por eso hay dos opciones:

### Opción A: HTTPS por Wi-Fi (Android y iPhone)

1. El teléfono y la computadora deben estar en la **misma red Wi-Fi**.
2. Con el backend corriendo, en `frontend/` ejecuta `npm run dev:https`.
3. La terminal muestra una dirección `Network`, por ejemplo `https://192.168.1.50:5173`. Ábrela en el teléfono **con https**.
4. El navegador avisará de que la conexión no es privada (el certificado lo genera tu computadora). Pulsa **Configuración avanzada → Continuar**.
5. Acepta el permiso de cámara.

En Windows, si el teléfono no carga la página, permite el acceso de Node.js en el aviso del **Firewall de Windows** (redes privadas).

### Opción B: `localhost` en Android por cable USB (sin aviso de certificado)

1. En el teléfono, activa **Opciones de desarrollador → Depuración USB** y conéctalo por cable.
2. Instala adb ([Android Platform Tools](https://developer.android.com/tools/releases/platform-tools); en Ubuntu `sudo apt install adb`).
3. Ejecuta `adb reverse tcp:5173 tcp:5173`.
4. Con `npm run dev` corriendo, abre `http://localhost:5173` en Chrome del teléfono.

En iPhone no existe un equivalente: usa la opción A.

> En muchos navegadores móviles la voz no suena hasta el primer toque en la pantalla; la bienvenida puede no oírse, pero el lector de pantalla sí la recibe.

## 5. El modelo

| Dato | Valor |
|---|---|
| Arquitectura | YOLO11n (detección), base `yolo11n.pt` |
| Dataset | Roboflow `derick-fernandez/billetes-mx`, versión 3 |
| Entrenamiento | 100 épocas, `imgsz=640`, Ultralytics 8.4.195 |
| Archivo | `models/best.pt` |

**Métricas en validación** (guardadas en el propio `best.pt`):

| Precisión | Recall | mAP50 | mAP50-95 |
|---|---|---|---|
| 0.983 | 0.974 | 0.991 | 0.879 |

Son métricas del conjunto de validación del dataset; deben confirmarse con fotografías nuevas tomadas en condiciones reales (ver [criterios de prueba](#12-criterios-de-prueba)). La confianza del detector no es una probabilidad de acierto calibrada.

**Clases** (10) y su traducción en `backend/classes.json`:

| Clase del modelo | Se anuncia como |
|---|---|
| `20_nuevo`, `20_viejo` | 20 pesos mexicanos |
| `50_nuevo`, `50_viejo` | 50 pesos mexicanos |
| `100_nuevo`, `100_viejo` | 100 pesos mexicanos |
| `200_nuevo` | 200 pesos mexicanos |
| `500_nuevo`, `500_viejo` | 500 pesos mexicanos |
| `1000_nuevo` | 1000 pesos mexicanos |

«nuevo» y «viejo» son las dos familias de diseño del mismo billete. El modelo **no** se entrenó con el billete de 200 de la familia anterior ni con el de 1000 de la familia anterior.

### Reemplazar el modelo

1. Copia el nuevo `best.pt` a `models/best.pt`.
2. Si cambiaron los nombres de las clases, actualiza `backend/classes.json`. Si una clase contiene el número (p. ej. `200_pesos`), el backend deduce la denominación solo.
3. Reinicia el backend. Al arrancar imprime las clases y avisa de las que no sabe interpretar.
4. Si entrenaste con otra versión de Ultralytics, actualiza `ultralytics==…` en `backend/requirements.txt`.

## 6. Entrenamiento en Google Colab

Resumen de la guía completa en [`README_BILLETES_MX.md`](README_BILLETES_MX.md). Solo hace falta si se quiere **reentrenar**; para usar la aplicación basta con `models/best.pt`.

**Requisitos:** cuenta de Roboflow con acceso a `derick-fernandez/billetes-mx` (versión 3) y Google Colab, de preferencia con GPU T4.

> **Seguridad:** nunca publiques claves API en notebooks, commits, capturas o README. En Colab guarda la clave en **Secrets** con el nombre `ROBOFLOW_API_KEY`. Si una clave se compartió, revócala y genera otra.

**6.1 Activar GPU:** *Entorno de ejecución → Cambiar tipo de entorno de ejecución → GPU T4*.

```python
import torch
print('CUDA disponible:', torch.cuda.is_available())
```

**6.2 Instalar dependencias**

```python
!pip install -q roboflow ultralytics pyyaml
```

**6.3 Descargar el dataset** (se guarda en el almacenamiento temporal de Colab, no en tu computadora)

```python
from google.colab import userdata
from roboflow import Roboflow
from pathlib import Path

rf = Roboflow(api_key=userdata.get('ROBOFLOW_API_KEY'))
project = rf.workspace('derick-fernandez').project('billetes-mx')
dataset = project.version(3).download('yolov11', location='/content/billetes-mx')
data_yaml = str(Path(dataset.location) / 'data.yaml')
```

**6.4 Revisar las clases**

```python
import yaml
with open(data_yaml, encoding='utf-8') as f:
    config = yaml.safe_load(f)
print('Clases:', config['names'], '| Número:', config['nc'])
```

Verifica que cada etiqueta corresponde a la denominación correcta y que validación y prueba no tengan fotos casi idénticas a las de entrenamiento.

**6.5 Entrenar**

```python
from ultralytics import YOLO
import torch

device = 0 if torch.cuda.is_available() else 'cpu'

# Prueba rápida (5 épocas) para comprobar que todo funciona
YOLO('yolo11n.pt').train(data=data_yaml, epochs=5, imgsz=640, batch=8, device=device,
                         project='/content/resultados_billetes', name='prueba')

# Entrenamiento principal
YOLO('yolo11n.pt').train(data=data_yaml, epochs=100, imgsz=640, batch=8, patience=20,
                         device=device, project='/content/resultados_billetes',
                         name='modelo_v1', plots=True)
```

Si se agota la memoria de la GPU, baja `batch` a 4 o `imgsz` a 512.

**6.6 Evaluar**

```python
ruta_modelo = '/content/resultados_billetes/modelo_v1/weights/best.pt'
modelo_final = YOLO(ruta_modelo)
print('Clases entrenadas:', modelo_final.names)
metricas = modelo_final.val(data=data_yaml, split='test')   # usa split='val' si no hay test
print('mAP50:', metricas.box.map50, '| mAP50-95:', metricas.box.map)
```

Conserva `results.png`, `confusion_matrix.png` y las métricas por clase.

**6.7 Descargar el modelo**

```python
from google.colab import files
files.download(ruta_modelo)
```

Si la descarga no empieza, abre el panel de archivos de Colab (icono de carpeta), ve a `resultados_billetes/modelo_v1/weights/`, clic derecho en `best.pt` → **Descargar**. Hazlo **antes de cerrar la sesión**: Colab borra `/content` al reiniciarse.

> Si aparece `NameError: name 'modelo_entrenado' is not defined`, la sesión se reinició o la celda que crea la variable no se ejecutó: vuelve a cargar el modelo con `YOLO(ruta_modelo)` en la misma celda.

Copia el archivo descargado a `models/best.pt` y sigue [Reemplazar el modelo](#reemplazar-el-modelo).

## 7. API del backend

### `GET /api/health`

Responde `200 {"status": "ok", "model": "best.pt", "classes": [...]}` si el modelo está cargado, o `503` si no se encontró. El frontend lo usa para avisar si el reconocimiento está disponible.

### `POST /api/identify`

Recibe la foto como `multipart/form-data` en el campo `image`.

```bash
curl -F "image=@billete.jpg" http://localhost:8000/api/identify
```

**Billete identificado**

```json
{
  "success": true,
  "prediction": {
    "class": "200_nuevo",
    "denomination": 200,
    "currency": "MXN",
    "confidence": 0.98,
    "bbox": [112.4, 230.1, 1490.7, 905.3]
  },
  "message": "Billete de 200 pesos mexicanos identificado",
  "annotated_image": "<JPEG en base64 con la caja dibujada>"
}
```

**Sin resultado**

```json
{
  "success": false,
  "prediction": null,
  "message": "No se pudo identificar el billete",
  "error_code": "no_detection"
}
```

| `error_code` | Cuándo | Qué le dice la app al usuario |
|---|---|---|
| `blurry_image` | La foto está borrosa (varianza del Laplaciano baja) | Mantener el teléfono quieto y con más luz |
| `partial_banknote` | Confianza baja y la caja toca el borde de la foto | Alejar el teléfono para que quepa el billete completo |
| `no_detection` | YOLO no encontró ningún billete | Colocar el billete plano y sin dedos encima |
| `low_confidence` | Confianza menor que `MIN_CONFIDENCE` | Mejor luz, sin reflejos, o fotografiar el otro lado |
| `invalid_image` | El archivo no es una imagen (HTTP 422) o pesa más de 15 MB (413) | Tomar otra foto |

`bbox` está en píxeles de la imagen recibida. El frontend también trata los errores de red, el tiempo de espera agotado y el servidor caído (5xx).

Los tipos del contrato están en `frontend/src/types/identification.ts` y su traducción a la interfaz en `frontend/src/services/identificationService.ts`: si el contrato cambia, solo hay que tocar esos dos archivos.

## 8. Frontend y accesibilidad

**Pantallas**

- **Inicio:** botón grande «IDENTIFICAR BILLETE», «ESCUCHAR INSTRUCCIONES», acceso a configuración y estado del servidor.
- **Identificación:** vista previa de la cámara trasera con guía de encuadre, botón «Capturar» a todo lo ancho en la parte inferior, opción «Elegir imagen» de la galería e indicaciones por voz.
- **Resultado:** denominación, moneda, clase YOLO, porcentaje de confianza e imagen con la detección; botones «Escuchar resultado» e «Identificar otro billete».
- **Configuración:** voz, velocidad de voz, sonidos y vibración, alto contraste, tamaño de texto y confianza mínima. Se guarda en el dispositivo.

**Accesibilidad**

- Cada mensaje llega por dos caminos: regiones `aria-live` para el lector de pantalla y la voz propia de la app (Web Speech API, español de México). La voz propia se puede desactivar para no oír todo dos veces.
- Al cambiar de pantalla o recibir un resultado, el foco pasa al encabezado.
- Tono y vibración al capturar, al acertar y al fallar.
- Botones de al menos 64 px de alto, foco muy visible, alto contraste y cuatro tamaños de texto. Respeta «reducir movimiento» y «más contraste» del sistema.
- Navegación completa con teclado; `Escape` vuelve al inicio.
- Ante resultados dudosos la app pide otra foto en lugar de anunciar un valor como seguro.

Las tecnologías usadas están en [Tecnologías](#tecnologías).

## 9. Configuración

### Backend (variables de entorno)

| Variable | Por defecto | Qué hace |
|---|---|---|
| `MODEL_PATH` | `models/best.pt` (raíz del repositorio) | Ruta de los pesos |
| `CLASSES_PATH` | `backend/classes.json` | Mapa clase → denominación y moneda |
| `DEFAULT_CURRENCY` | `MXN` | Moneda si la clase no la indica |
| `DETECTION_CONFIDENCE` | `0.25` | Umbral de YOLO para considerar una detección |
| `MIN_CONFIDENCE` | `0.6` | Por debajo, responde `low_confidence` |
| `BLUR_THRESHOLD` | `60` | Por debajo, la foto se considera borrosa |
| `RETURN_ANNOTATED` | `1` | Devolver la imagen con la caja dibujada (`0` para desactivar) |
| `CORS_ORIGINS` | `*` | Orígenes permitidos si el frontend se sirve desde otro dominio |

Ejemplo: `MIN_CONFIDENCE=0.7 uvicorn app.main:app --port 8000` (en PowerShell: `$env:MIN_CONFIDENCE="0.7"` antes del comando).

### Frontend

| Variable | Dónde | Qué hace |
|---|---|---|
| `BACKEND_URL` | al ejecutar `npm run dev` | Dirección del backend para el proxy de desarrollo (por defecto `http://localhost:8000`) |
| `VITE_API_BASE_URL` | `frontend/.env` | URL del backend en producción, si está en otro dominio (vacío = mismo origen) |
| `VITE_API_TIMEOUT_MS` | `frontend/.env` | Tiempo máximo de espera de la identificación (por defecto 20000) |

Copia `frontend/.env.example` a `frontend/.env` para cambiarlas.

## 10. Solución de problemas

| Síntoma | Causa probable y solución |
|---|---|
| La página dice «el reconocimiento real todavía no está disponible» | El backend no está corriendo, no está en el puerto 8000 o no encontró `models/best.pt`. Mira la terminal del backend y abre http://localhost:8000/api/health. |
| `AVISO: No se encontró el modelo en …` | Falta `models/best.pt` en la raíz del repositorio. |
| `The virtual environment was not created successfully because ensurepip is not available` | Ubuntu/Debian: `sudo apt install python3-venv` (o `python3.12-venv`). |
| `python` no se reconoce (Windows) | Reinstala Python marcando «Add python.exe to PATH», o usa `py` en lugar de `python`. |
| `uvicorn` no se reconoce | El entorno virtual no está activado: `source .venv/bin/activate` o `.venv\Scripts\Activate.ps1`. |
| Error al cargar el modelo (`AttributeError`, `ModuleNotFoundError` de Ultralytics) | La versión de `ultralytics` instalada no coincide con la del entrenamiento. Debe ser la de `requirements.txt` (8.4.195). |
| `Address already in use` / el puerto está ocupado | Ya hay otro proceso en 8000 o 5173. Ciérralo o usa otro puerto: `--port 8001` y `BACKEND_URL=http://localhost:8001 npm run dev` (PowerShell: `$env:BACKEND_URL="http://localhost:8001"; npm run dev`). |
| La cámara no se activa en el teléfono | La página no está en https. Usa `npm run dev:https` (ver [sección 4](#4-probar-en-el-teléfono)). |
| «No hay permiso para usar la cámara» | Permite la cámara en los ajustes del sitio en el navegador y recarga. |
| No se oye la voz | Toca la pantalla una vez (los navegadores móviles bloquean el audio hasta la primera interacción), sube el volumen y revisa que «Voz de la aplicación» esté activada en Configuración. |
| El teléfono no abre la dirección `Network` | Comprueba que ambos estén en la misma Wi-Fi y que el firewall permita Node.js. |

## 11. Flujo de trabajo en equipo

1. Quien entrena sube el notebook (**sin credenciales**), `models/best.pt`, la lista de clases y las métricas.
2. Quien implementa desarrolla la API y el frontend en su propia rama.
3. Ambos abren pull requests hacia `main`, revisan y fusionan.
4. Se prueba con fotografías nuevas sin reentrenar y se documentan resultados, errores y limitaciones.

```bash
git checkout main
git pull origin main
git checkout -b feature/mi-cambio
# ...cambios...
git add .
git commit -m "Describe el cambio"
git push -u origin feature/mi-cambio
```

No subas el dataset completo, entornos virtuales (`.venv/`), `node_modules/` ni secretos. Si el modelo llegara a superar los límites de GitHub (100 MB por archivo), usa Git LFS o un Release y documenta cómo obtenerlo.

## 12. Criterios de prueba

- Probar todas las denominaciones incluidas en el modelo, de ambas familias cuando existan.
- Fotografiar ambas caras, con distintos ángulos, distancias, fondos y niveles de luz.
- Registrar falsos positivos, confusiones entre denominaciones y rechazos.
- Medir precisión y recall por clase, matriz de confusión y tiempo de respuesta.
- Probar con un billete, con varios billetes y con escenas sin billetes.
- Confirmar que la voz funciona y se puede repetir.
- Verificar con teclado, con TalkBack/VoiceOver/NVDA y con controles táctiles.
- Validar con personas usuarias, con su consentimiento, antes de afirmar que la aplicación es apta para el uso diario.

## 13. Fuentes y licencias

- [Repositorio del proyecto](https://github.com/DiskHD/prepu.coders)
- [Google Colab](https://colab.research.google.com/) · [Roboflow](https://roboflow.com/)
- [Ultralytics YOLO11](https://docs.ultralytics.com/models/yolo11/) · [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/) · [Vite](https://vite.dev/) · [Tailwind CSS](https://tailwindcss.com/)
- [Banco de México: billetes en circulación](https://www.banxico.org.mx/)

Antes de redistribuir imágenes o el modelo, revisa las licencias del dataset de Roboflow y de Ultralytics (AGPL-3.0), sobre todo si el proyecto se publicará o comercializará.

## Conteo y suma de múltiples billetes mexicanos

La pantalla de identificación permite elegir **Contar y sumar billetes mexicanos**
(modo inicial) o **Identificar un billete** (comportamiento individual anterior).
Coloca los billetes completos, separados y con buena iluminación. El resultado
muestra cantidad, total en MXN, denominación y confianza de cada billete, y las
cajas sobre la foto. El asistente anuncia el total en español (`es-MX`), conserva
los anuncios para lectores de pantalla y permite repetir el resultado.

El detector está en `backend/app/detector.py`, la API FastAPI en
`backend/app/main.py` y la interfaz en `frontend/src/pages/Identification.tsx`.
Se verificó que `models/best.pt` es un modelo de detección con estas clases reales:
`1000_nuevo`, `100_nuevo`, `100_viejo`, `200_nuevo`, `20_nuevo`, `20_viejo`,
`500_nuevo`, `500_viejo`, `50_nuevo`, `50_viejo`.
El conteo usa exclusivamente su correspondencia explícita en `backend/classes.json`;
no deduce cantidades a partir de números en etiquetas desconocidas.

### API compatible

`POST /api/identify` conserva el contrato individual y `/api/health` sigue disponible.
`POST /api/count` acepta la misma imagen multipart en el campo `image`.
También se puede usar `POST /api/identify?multiple=true`.

```bash
curl -F image=@foto.jpg http://localhost:8000/api/count
```

Ejemplo abreviado con dos billetes de 20 pesos (las cajas están en píxeles de la
imagen orientada según EXIF):

```json
{
  "success": true,
  "prediction": {"class": "20_nuevo", "denomination": 20, "currency": "MXN", "confidence": 0.95, "bbox": [20, 20, 100, 100]},
  "count": 2,
  "total": 40,
  "currency": "MXN",
  "detections": [
    {"class": "20_nuevo", "denomination": 20, "currency": "MXN", "confidence": 0.95, "bbox": [20, 20, 100, 100]},
    {"class": "20_viejo", "denomination": 20, "currency": "MXN", "confidence": 0.90, "bbox": [120, 20, 200, 100]}
  ],
  "groups": [{"denomination": 20, "count": 2, "subtotal": 40}],
  "rejected_detections": [],
  "partial": false,
  "message": "Se identificaron 2 billetes. Total: 40 pesos mexicanos."
}
```

Se aplica NMS independiente de clase tanto en YOLO como al procesar las cajas:
`NMS_IOU=0.5` por defecto. Conserva cajas separadas aunque tengan la misma clase.
La suma excluye confianza inferior a `MIN_CONFIDENCE` (0.6), cajas que tocan el
margen del 1 % de la imagen, clases sin correspondencia explícita y monedas ajenas
a MXN. `DETECTION_CONFIDENCE` (0.25) controla el umbral inicial de YOLO.
El frontend también respeta el umbral de confianza elegido en ajustes; si alguna
caja aceptada por el servidor queda por debajo, pide repetir la foto.

`rejected_detections` contiene clase, confianza, caja y motivo de exclusión.
Si se aceptan unos billetes y se excluyen otros, `partial=true` indica que el total
puede ser parcial y se anuncia esa advertencia. Si no se acepta ninguno se devuelve
`success=false`, `count=0`, `total=0`. Con un modelo de clasificación, el conteo
responde `error_code=detector_required`, `total=null` y explica que se necesita un
detector; el modo individual sigue funcionando sin inventar cajas.

### Verificación y límites

```bash
cd backend
.venv/bin/python -m unittest discover -s tests -v
cd ../frontend
npm run build
```

Las pruebas usan `unittest` y `httpx` (instalar este último en el entorno de pruebas
con `pip install -r requirements-test.txt`). Cubren repetidos, suma mixta, desconocidos, duplicados
entre clases, baja confianza, recortes, clasificación, compatibilidad HTTP y una
inferencia real de una imagen vacía con `best.pt`.

NMS reduce duplicados, pero billetes muy superpuestos pueden suprimirse como una
misma caja. Los billetes que YOLO no detecta no se pueden incluir ni marcar como
rechazados: `partial=false` no garantiza que estén todos. Hace falta evaluar fotos
reales etiquetadas para medir precisión y calibrar umbrales; este repositorio no
incluye ese conjunto de validación. La voz requiere soporte del navegador y estar
activada en ajustes; los anuncios para lectores de pantalla permanecen disponibles.

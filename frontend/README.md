# Billete al Tiro — Frontend

Interfaz accesible (React + TypeScript + Tailwind) para identificar billetes con la cámara.
El reconocimiento lo hace **exclusivamente** el backend Python (FastAPI + YOLO); el frontend
no genera predicciones propias.

## Uso

```bash
npm install
npm run dev        # http://localhost:5173, redirige /api → http://localhost:8000
npm run dev:https  # igual, pero con HTTPS para probar la cámara en el teléfono
npm run build
```

- Otro puerto de backend en desarrollo: `BACKEND_URL=http://localhost:9000 npm run dev`.
- Backend en otro dominio en producción: `VITE_API_BASE_URL=https://api.ejemplo.com` (ver `.env.example`; el backend debe permitir CORS).
- La cámara solo funciona en `https` o `localhost`.

## Probar en el teléfono

**Opción A — HTTPS por la red local (cualquier teléfono)**

1. El teléfono y el ordenador deben estar en la misma red Wi-Fi.
2. `npm run dev:https`
3. En el teléfono abre la dirección `Network` que muestra la terminal, con **https**: `https://192.168.x.x:5173`.
4. El navegador avisará de que el certificado no es de confianza (es autofirmado): pulsa *Configuración avanzada → Continuar*. Después acepta el permiso de cámara.

**Opción B — `localhost` en Android por USB (sin aviso de certificado)**

1. Activa la *Depuración USB* en el teléfono y conéctalo por cable.
2. Instala adb (`sudo apt install adb`) y ejecuta `adb reverse tcp:5173 tcp:5173`.
3. `npm run dev` y abre `http://localhost:5173` en Chrome del teléfono.

En iPhone no existe un equivalente a `adb reverse`: usa la opción A.

## Contrato con el backend (propuesta)

`POST /api/identify` — `multipart/form-data`, campo `image`.

```json
{
  "success": true,
  "prediction": { "class": "200_pesos", "denomination": 200, "currency": "MXN", "confidence": 0.98 },
  "message": "Billete de 200 pesos mexicanos identificado"
}
```

Sin detección: `{ "success": false, "prediction": null, "message": "No se pudo identificar el billete" }`.

Campos opcionales que la interfaz ya aprovecha si llegan:

| Campo | Uso |
|---|---|
| `error_code` | `blurry_image`, `partial_banknote`, `no_detection`, `low_confidence`, `invalid_image` → indicaciones específicas por voz |
| `prediction.bbox` | `[x1, y1, x2, y2]` en píxeles de la imagen recibida → caja dibujada sobre la foto |
| `annotated_image` | data URL, base64 JPEG o URL → imagen con la detección |

`GET /api/health` — cualquier respuesta que no sea 5xx se toma como "servidor en línea".

Los tipos están en `src/types/identification.ts` y el mapeo a la interfaz en
`src/services/identificationService.ts`: si el contrato cambia, solo se tocan esos dos archivos.

## Accesibilidad

- Cada mensaje llega por dos caminos: regiones `aria-live` (TalkBack, VoiceOver, NVDA) y voz propia (Web Speech API). La voz propia se puede desactivar.
- Al cambiar de pantalla o recibir un resultado, el foco pasa al encabezado.
- Tonos y vibración al capturar y al recibir el resultado.
- Alto contraste, cuatro tamaños de texto, velocidad de voz y confianza mínima en Configuración (se guardan en el dispositivo).
- Navegación por teclado completa; `Escape` vuelve al inicio.

/**
 * Textos que se muestran y se leen en voz alta. Centralizados para que la
 * voz, la pantalla y los anuncios aria-live digan siempre lo mismo.
 */

import type { BanknotePrediction, IdentificationErrorKind } from '../types/identification';

export const percent = (confidence: number) => Math.round(confidence * 100);

export const SPOKEN = {
  welcome:
    'Bienvenido a Billete al Tiro. Pulsa el botón Identificar billete para usar la cámara, o Escuchar instrucciones para saber cómo funciona.',
  instructions:
    'Billete al Tiro te dice el valor de un billete usando la cámara. ' +
    'Pulsa Identificar billete. Coloca el billete sobre una superficie plana y con buena luz. ' +
    'Sostén el teléfono a unos 25 centímetros, por encima del billete, con la cámara trasera apuntando hacia él. ' +
    'Procura que el billete completo quepa en la imagen. ' +
    'Después pulsa el botón Capturar, que ocupa la parte inferior de la pantalla. ' +
    'Escucharás el resultado en unos segundos. También puedes elegir una foto de tu galería.',
  cameraReady:
    'Cámara lista. Coloca el billete plano, con buena luz, a unos 25 centímetros. Que se vea completo. ' +
    'El botón Capturar está en la parte inferior de la pantalla.',
  cameraUnavailable:
    'No se pudo usar la cámara. Puedes elegir una foto de tu galería con el botón Elegir imagen.',
  processing: 'Foto tomada. Analizando el billete, espera un momento.',
  backendOffline:
    'Aviso: no hay conexión con el servidor de reconocimiento, así que el reconocimiento real todavía no está disponible.',
} as const;

export function resultSpeech(p: BanknotePrediction): string {
  return `Se ha identificado un billete de ${p.denomination} ${p.currencyName}. Nivel de confianza: ${percent(p.confidence)} por ciento.`;
}

export interface ErrorCopy {
  title: string;
  /** Instrucción concreta de qué hacer a continuación. */
  advice: string;
}

export const ERROR_COPY: Record<IdentificationErrorKind, ErrorCopy> = {
  detector_required: {
    title: 'Se necesita un modelo de detección',
    advice: 'El modelo cargado es de clasificación. Puedes usar el modo Identificar un billete.',
  },
  blurry_image: {
    title: 'La imagen está borrosa',
    advice: 'Mantén el teléfono quieto, apóyalo si puedes, y vuelve a capturar con más luz.',
  },
  partial_banknote: {
    title: 'El billete no se ve completo',
    advice: 'Aleja un poco el teléfono para que el billete entero quepa en la imagen y vuelve a capturar.',
  },
  no_detection: {
    title: 'No se detectó ningún billete',
    advice: 'Coloca el billete plano bajo la cámara, sin dedos encima, y vuelve a capturar.',
  },
  low_confidence: {
    title: 'No hay suficiente seguridad en el resultado',
    advice: 'Prueba con mejor iluminación, sin reflejos, o fotografía el otro lado del billete.',
  },
  invalid_image: {
    title: 'La imagen no es válida',
    advice: 'Toma una nueva foto o elige otra imagen en formato JPG o PNG.',
  },
  network_error: {
    title: 'Sin conexión',
    advice: 'Revisa tu conexión a internet y vuelve a intentarlo.',
  },
  server_unavailable: {
    title: 'Servidor no disponible',
    advice: 'El reconocimiento real todavía no está disponible. Inténtalo más tarde.',
  },
  timeout: {
    title: 'El servidor tardó demasiado',
    advice: 'Comprueba tu conexión y vuelve a capturar.',
  },
  unexpected_response: {
    title: 'Error de comunicación con el servidor',
    advice: 'Hubo un problema al recibir el resultado. Vuelve a intentarlo.',
  },
};

export function errorSpeech(kind: IdentificationErrorKind, prediction?: BanknotePrediction): string {
  const copy = ERROR_COPY[kind];
  let text = `${copy.title}. ${copy.advice}`;
  if (kind === 'low_confidence' && prediction) {
    text =
      `${copy.title}. Podría ser un billete de ${prediction.denomination} ${prediction.currencyName}, ` +
      `pero la confianza es solo de ${percent(prediction.confidence)} por ciento. ${copy.advice}`;
  }
  return `${text} Pulsa Intentar de nuevo.`;
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { almacenamientoDisponible, reconocerComprobante, TIPOS_ACEPTADOS } from "./comprobantes.js";

/**
 * Se prueba lo que se puede probar sin salir a la red: QUÉ ARCHIVO ENTRA.
 *
 * Es la pieza que importa. La cabecera `Content-Type` la escribe el navegador y
 * la puede falsear cualquiera, así que lo único que decide de verdad son los
 * bytes del archivo. Si esto se rompe, el bucket del CDA se vuelve un lugar
 * donde subir cualquier cosa.
 */

/** Rellena para llegar al mínimo de 12 bytes que exige el reconocedor. */
function conFirma(...bytes: number[]): Buffer {
  return Buffer.concat([Buffer.from(bytes), Buffer.alloc(32, 0x20)]);
}

const JPEG = conFirma(0xff, 0xd8, 0xff, 0xe0);
const PNG = conFirma(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const PDF = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(32, 0x20)]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
  Buffer.alloc(32, 0x20),
]);

describe("reconocerComprobante", () => {
  it("reconoce los cuatro tipos que el CDA acepta", () => {
    assert.equal(reconocerComprobante(JPEG)?.tipo, "image/jpeg");
    assert.equal(reconocerComprobante(PNG)?.tipo, "image/png");
    assert.equal(reconocerComprobante(WEBP)?.tipo, "image/webp");
    assert.equal(reconocerComprobante(PDF)?.tipo, "application/pdf");
  });

  it("da la extensión que le corresponde a cada uno", () => {
    // El nombre del archivo lo pone el servidor con esta extensión, nunca el que
    // mandó el cliente: un nombre ajeno es recorrido de rutas y además puede
    // traer datos personales de quien lo subió.
    assert.equal(reconocerComprobante(JPEG)?.extension, "jpg");
    assert.equal(reconocerComprobante(PNG)?.extension, "png");
    assert.equal(reconocerComprobante(WEBP)?.extension, "webp");
    assert.equal(reconocerComprobante(PDF)?.extension, "pdf");
  });

  it("RECHAZA un ejecutable aunque venga disfrazado de imagen", () => {
    // El caso que justifica todo el archivo: `Content-Type: image/jpeg` con un
    // PE de Windows adentro. La cabecera decía imagen; los bytes dicen otra cosa.
    const ejecutable = conFirma(0x4d, 0x5a, 0x90, 0x00);
    assert.equal(reconocerComprobante(ejecutable), null);
  });

  it("rechaza HTML, SVG y texto plano", () => {
    // SVG es una imagen y aun así no entra: lleva scripts adentro, y servido
    // desde el almacenamiento se ejecutaría en el navegador de quien lo abra.
    for (const contenido of ["<svg xmlns='http://www.w3.org/2000/svg'>", "<!DOCTYPE html><html>", "hola que tal"]) {
      assert.equal(reconocerComprobante(Buffer.from(contenido)), null, `'${contenido}' no debía pasar`);
    }
  });

  it("rechaza un archivo vacío o demasiado corto para tener firma", () => {
    assert.equal(reconocerComprobante(Buffer.alloc(0)), null);
    assert.equal(reconocerComprobante(Buffer.from([0xff, 0xd8, 0xff])), null);
  });

  it("un ZIP con la extensión cambiada tampoco pasa", () => {
    assert.equal(reconocerComprobante(conFirma(0x50, 0x4b, 0x03, 0x04)), null);
  });
});

describe("almacenamientoDisponible", () => {
  it("está apagado mientras no haya credenciales, y eso es lo que hace fallar cerrado", () => {
    // En las pruebas no hay SUPABASE_URL ni la clave de servicio. La ruta lo
    // consulta para responder 503 en vez de guardar el archivo en otro lado.
    assert.equal(almacenamientoDisponible(), false);
  });
});

describe("TIPOS_ACEPTADOS", () => {
  it("es lo que la ruta le declara a express.raw, y coincide con las firmas", () => {
    // Si estas dos listas se desincronizaran, `raw` aceptaría un tipo que el
    // reconocedor después rechaza —o peor, al revés—.
    assert.deepEqual([...TIPOS_ACEPTADOS].sort(), [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });
});

import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { FiltroMensajes, Mensaje, NuevoMensaje } from "../tipos/mensaje.js";
import { fechaHoyEnColombia } from "../utilidades/fecha.js";
import { AlmacenColeccionJson } from "./almacenJson.js";
import type { RepositorioMensajes } from "./repositorioMensajes.js";

const ARCHIVO_MENSAJES = "mensajes.json";

/**
 * Implementación de RepositorioMensajes sobre un archivo JSON.
 *
 * PROVISIONAL: sirve mientras no está Postgres/Supabase. Los mensajes tienen
 * datos personales, así que el archivo que genera no se versiona (ver .gitignore).
 */
export class RepositorioMensajesArchivo implements RepositorioMensajes {
  private readonly almacen: AlmacenColeccionJson<Mensaje>;

  constructor(directorioDatos: string, nombreArchivo: string = ARCHIVO_MENSAJES) {
    this.almacen = new AlmacenColeccionJson<Mensaje>(resolve(directorioDatos, nombreArchivo));
  }

  async crear(datos: NuevoMensaje): Promise<Mensaje> {
    const mensaje: Mensaje = {
      id: randomUUID(),
      name: datos.name,
      email: datos.email,
      message: datos.message,
      date: fechaHoyEnColombia(),
      creadoEn: new Date().toISOString(),
    };

    // Se guarda al principio para mantener el orden "más reciente primero" que
    // el frontend ya producía con messages.unshift(...).
    await this.almacen.transaccion((actuales) => ({
      items: [mensaje, ...actuales],
      resultado: mensaje,
    }));

    return mensaje;
  }

  async listar(filtro?: FiltroMensajes): Promise<Mensaje[]> {
    const mensajes = await this.almacen.leerTodo();
    const ordenados = [...mensajes].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

    if (filtro === undefined) return ordenados;

    // Las fechas 'YYYY-MM-DD' se pueden comparar como cadenas.
    const filtrados = ordenados.filter((mensaje) => {
      if (filtro.desde !== undefined && mensaje.date < filtro.desde) return false;
      if (filtro.hasta !== undefined && mensaje.date > filtro.hasta) return false;
      return true;
    });

    return filtro.limite === undefined ? filtrados : filtrados.slice(0, filtro.limite);
  }
}

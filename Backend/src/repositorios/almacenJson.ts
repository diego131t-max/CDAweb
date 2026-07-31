import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Colección persistida en un archivo JSON.
 *
 * Es un detalle de implementación de los repositorios en archivo: nada fuera de
 * src/repositorios/ debería importar esta clase. Desaparece cuando migremos a
 * Postgres/Supabase.
 *
 * Dos cuidados importantes:
 * - Las operaciones se encolan para que dos peticiones simultáneas no se pisen
 *   al hacer leer-modificar-escribir.
 * - La escritura es atómica (archivo temporal + rename) para que un corte a
 *   mitad de camino no deje el JSON truncado.
 */
export class AlmacenColeccionJson<T> {
  private readonly rutaArchivo: string;
  private cola: Promise<unknown> = Promise.resolve();

  constructor(rutaArchivo: string) {
    this.rutaArchivo = rutaArchivo;
  }

  /** Devuelve una copia de los elementos guardados. */
  async leerTodo(): Promise<T[]> {
    return this.encolar(() => this.leerDesdeDisco());
  }

  /**
   * Lee, transforma y vuelve a escribir la colección en una sola operación
   * serializada. `transformar` recibe el contenido actual y devuelve el nuevo.
   */
  async transaccion<R>(transformar: (actuales: T[]) => { items: T[]; resultado: R }): Promise<R> {
    return this.encolar(async () => {
      const actuales = await this.leerDesdeDisco();
      const { items, resultado } = transformar(actuales);
      await this.escribirEnDisco(items);
      return resultado;
    });
  }

  /** Serializa las operaciones: cada tarea espera a que termine la anterior. */
  private encolar<R>(tarea: () => Promise<R>): Promise<R> {
    const siguiente = this.cola.then(tarea, tarea);
    // La cola nunca queda rechazada: un error en una tarea no debe bloquear las siguientes.
    this.cola = siguiente.then(
      () => undefined,
      () => undefined,
    );
    return siguiente;
  }

  private async leerDesdeDisco(): Promise<T[]> {
    let contenido: string;
    try {
      contenido = await readFile(this.rutaArchivo, "utf8");
    } catch (error) {
      // Todavía no existe el archivo: colección vacía.
      if (esErrorDeArchivoInexistente(error)) return [];
      throw error;
    }

    if (contenido.trim() === "") return [];

    let datos: unknown;
    try {
      datos = JSON.parse(contenido);
    } catch {
      // Se prefiere fallar antes que sobrescribir datos que no entendemos.
      throw new Error(`El archivo de datos ${this.rutaArchivo} no contiene JSON válido.`);
    }

    if (!Array.isArray(datos)) {
      throw new Error(`El archivo de datos ${this.rutaArchivo} debería contener un arreglo.`);
    }

    return datos as T[];
  }

  private async escribirEnDisco(items: T[]): Promise<void> {
    await mkdir(dirname(this.rutaArchivo), { recursive: true });
    const temporal = `${this.rutaArchivo}.${process.pid}.tmp`;
    await writeFile(temporal, `${JSON.stringify(items, null, 2)}\n`, "utf8");
    await rename(temporal, this.rutaArchivo);
  }
}

function esErrorDeArchivoInexistente(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

type ErrorConsulta = { message: string };

export async function cargarTodasLasPaginas<T>(
  consultar: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: ErrorConsulta | null }>,
  tamanoPagina = 500,
): Promise<{ data: T[]; error: ErrorConsulta | null }> {
  const data: T[] = [];
  for (let pagina = 0; ; pagina += 1) {
    const respuesta = await consultar(pagina * tamanoPagina, (pagina + 1) * tamanoPagina - 1);
    if (respuesta.error) return { data: [], error: respuesta.error };
    const filas = respuesta.data || [];
    data.push(...filas);
    if (filas.length < tamanoPagina) return { data, error: null };
  }
}

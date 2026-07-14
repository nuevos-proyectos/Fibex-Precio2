# Arquitectura de la aplicación

## Estructura de archivos
- `main.py`: servidor FastAPI.
- `requirements.txt`: dependencias Python.
- `templates/index.html`: panel de usuario y administrador.
- `templates/tabulador.html`: plantilla Jinja para generar el PDF.
- `static/`: activos estáticos, incluyendo `logo.png`.

## Flujo general
1. El usuario entra a `/` y carga `index.html`.
2. Inicia sesión en `/auth/login` con email y contraseña.
3. La app recibe un token de sesión y carga datos auxiliares desde `/data/auxiliar`.
4. El usuario selecciona:
   - columna A (región principal)
   - columna B (región comparativa opcional)
   - revisión
   - tipos de precio a mostrar: NP, O&M 1 y/o O&M 2
5. Para la administración de versiones:
   - el botón `Crear Borrador` genera un nuevo registro de revisión en estado `borrador`.
   - el sistema clona los precios de la última revisión publicada al nuevo borrador.
   - el administrador edita precios solo cuando la revisión está en estado `borrador`.
   - el botón `Crear Borrador` ya no recarga la página; en lugar de eso, actualiza el panel y selecciona el borrador abierto.
   - la vista previa del PDF puede cargar el borrador para revisar los cambios.
   - el botón `Congelar y Publicar` convierte el borrador en `publicada` y archiva la versión anterior.
6. Al solicitar vista previa, el frontend genera la URL `/tabulador/ver-pdf` con parámetros y carga el PDF en un `iframe`.
7. El backend consulta Supabase y devuelve un PDF generado con `xhtml2pdf`.

## Roles de usuario
- **Nivel 1: Visualizador Regional (Rol 1)**: Consulta local de solo lectura. Solo puede ver su región/ciudad asignada (y compararla con la base nacional de su país). No puede cambiar de revisión (siempre ve la última versión publicada de forma oficial).
- **Nivel 2: Visualizador General (Rol 2)**: Consulta global de solo lectura. Puede elegir cualquier país, región y cualquier versión/revisión disponible para generar o previsualizar el PDF.
- **Nivel 3: Gerente de Nuevos Proyectos (Rol 3)**: Administrador de Nuevos Proyectos. Tiene acceso a la pestaña de edición de precios, pero con filtros. Solo puede editar y guardar los precios de partidas pertenecientes a categorías de Nuevos Proyectos (NP, ej. Categoría 1). Las categorías de O&M se le muestran bloqueadas. En el guardado, solo altera `monto_usd`.
- **Nivel 4: Súper Administrador (Rol 4)**: Acceso total al sistema. Puede crear nuevos usuarios, tiene acceso completo a la pestaña de auditoría (ver historial de cambios por fecha), puede crear borradores, publicar o cancelar revisiones, y puede editar todos los precios de la matriz sin restricciones de categoría.
- **Nivel 5: Gerente de O&M (Rol 5)**: Administrador de Operación y Mantenimiento. Tiene acceso a la pestaña de edición de precios, pero solo puede editar y guardar los precios globales de O&M (`monto_om_1` y `monto_om_2`) para partidas pertenecientes a categorías de O&M (ej. Categoría 2 y 3). Las categorías de NP se le muestran bloqueadas.

## Panel administrativo
Funciones en `index.html` y `main.py`:
- Crear usuarios: `/admin/usuarios` (Restringido únicamente al Nivel 4)
- Crear y editar partidas: `/admin/partidas` y `/admin/partidas/{partida_id}`
- Crear regiones y países: `/admin/regiones` y `/admin/paises`
- Crear borrador de revisión: `/admin/revisiones/crear-borrador` (Clona automáticamente precios NP y precios O&M de la última revisión publicada)
- Publicar revisión: `/admin/revisiones/publicar` (Cambia borrador a publicada y archiva la anterior)
- Cancelar borrador: `/admin/revisiones/cancelar-borrador` (Descarta y elimina los precios de ese borrador)
- Obtener matriz de precios: `/admin/precios/matriz`
- Guardar precios NP (regionales): `/admin/precios/guardar`
- Obtener y guardar precios O&M (globales): `/admin/precios/om` y `/admin/precios/om/guardar`
- Módulo de Auditoría: `/admin/auditoria/fechas` y `/admin/auditoria/por-dia` (Restringido únicamente al Nivel 4)

## Generación del PDF
- `main.py` construye `documento_estructurado` agrupando partidas por categoría.
- Los precios NP se cargan de forma regionalizada desde `precios`.
- Los precios O&M se cargan de forma global desde `precios_om`.
- `tabulador.html` recibe los datos y decide columnas según las banderas `mostrar_np`, `mostrar_om1` y `mostrar_om2`.
- El PDF puede comparar dos regiones si se selecciona columna B, pero la columna B solo compara el precio NP. Los precios O&M son independientes y se muestran fijos del lado A ya que son globales.

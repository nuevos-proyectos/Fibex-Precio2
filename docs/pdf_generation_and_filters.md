# Generación de PDF y filtro de precios

## Lógica del filtro
- El PDF acepta tres tipos de precio:
  - `NP` (monto_usd)
  - `O&M Precio 1` (monto_om_1)
  - `O&M Precio 2` (monto_om_2)
- El frontend permite seleccionar uno o varios tipos simultáneamente.
- Si no se selecciona ningún tipo, el frontend muestra un error y no carga el PDF.

## Parámetros enviados al backend
- `token`: token de sesión del usuario.
- `col_a_id`: región principal.
- `col_b_id`: región comparativa opcional.
- `revision_id`: versión de precios.
- `mostrar_np`: booleano.
- `mostrar_om1`: booleano.
- `mostrar_om2`: booleano.

## Backend
- `main.py` usa esos flags para decidir qué columnas mostrar.
- Se consulta `precios` por `revision_id` y `region_id` para obtener el precio NP de la columna A y B.
- Se consulta `precios_om` por `revision_id` para obtener los precios O&M (precio 1 y 2) de forma global para toda la revisión (independientes de la región).
- Se construye `documento_estructurado` con categorías y partidas, mapeando a cada una sus precios NP y O&M según corresponda.
- Para el flujo de versiones:
  - `crear_borrador` crea un nuevo registro `borrador` y clona los precios de la última revisión publicada en las tablas `precios` y `precios_om`.
  - `guardar_precios_simultaneos` (NP) y `guardar_precio_om` (O&M) solo aceptarán cambios si la revisión está en estado `borrador`.
  - `publicar_revision` solo transforma `borrador` a `publicada`; si se intenta publicar algo distinto, devuelve error.

## Plantilla del PDF
- `tabulador.html` muestra:
  - Descripción de partida.
  - Unidad.
  - Columnas de precio para cada región seleccionada.
- Si `comparar` es verdadero, la región B solo compara el precio NP.
- Los precios O&M se muestran como columnas independientes ligadas de forma global a la región principal (A) y no se duplican para la región comparativa (B) porque son valores globales aplicables a todo el territorio bajo esa revisión.
- Al final de cada categoría se muestra una nota importante con condiciones del documento.
- Se agrega numeración de páginas en el pie de página del PDF.

## Notas importantes
- La estructura actual permite ver:
  - solo NP
  - solo O&M 1
  - solo O&M 2
  - NP + O&M 1
  - NP + O&M 2
  - O&M 1 + O&M 2
  - NP + O&M 1 + O&M 2
- En el PDF, si se compara con columna B, solo el precio NP se muestra en la columna B comparativa.
- O&M 1 y O&M 2 son independientes y siempre se asocian de forma global en la región A.


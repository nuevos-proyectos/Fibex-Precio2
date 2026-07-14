# Estructura de la base de datos

## Tablas principales

### `usuarios`
- id: serial, PK
- email: text NOT NULL
- password: text NOT NULL
- rol: integer NOT NULL
- pais_asignado_id: integer NULLABLE, FK -> `paises.id`
- region_asignada_id: integer NULLABLE, FK -> `regiones.id`
- token_sesion: text NULLABLE

### `revisiones`
- id: serial, PK
- numero_revision: text NOT NULL
- estado: text NOT NULL (`borrador`, `publicada`, `archivada`)
- fecha_creacion: timestamp NULL DEFAULT CURRENT_TIMESTAMP

### `paises`
- id: serial, PK
- nombre: text NOT NULL
- moneda_simbolo: varchar(10) NULL DEFAULT '$'

### `regiones`
- id: serial, PK
- pais_id: integer NULLABLE, FK -> `paises.id`
- nombre: text NOT NULL
- es_nacional: boolean NULL DEFAULT false

### `categorias`
- id: serial, PK
- nombre: text NOT NULL
- orden_impresion: integer NULLABLE

### `partidas`
- id: serial, PK
- categoria_id: integer NULLABLE, FK -> `categorias.id`
- descripcion: text NOT NULL
- unidad: text NOT NULL

### `precios`
- id: serial, PK
- revision_id: integer NULLABLE, FK -> `revisiones.id`
- partida_id: integer NULLABLE, FK -> `partidas.id`
- region_id: integer NULLABLE, FK -> `regiones.id`
- monto_usd: numeric(10, 2) NULL DEFAULT 0.00
- monto_om_1: numeric(10, 2) NULL DEFAULT 0.00  (Legacy/Secundario)
- monto_om_2: numeric(10, 2) NULL DEFAULT 0.00  (Legacy/Secundario)

### `precios_om`
- revision_id: integer, PK, FK -> `revisiones.id`
- partida_id: integer, PK, FK -> `partidas.id`
- monto_om_1: numeric(10, 2) NULL DEFAULT 0.00
- monto_om_2: numeric(10, 2) NULL DEFAULT 0.00

### `historial_cambios`
- id: serial, PK
- usuario_id: integer, FK -> `usuarios.id`
- usuario_nombre: text NOT NULL (email del usuario)
- modulo: text NOT NULL (ej. `sistema`, `usuarios`, `partidas`, `precios`, `revisiones`)
- accion: text NOT NULL (ej. `ACCESO`, `CREAR`, `MODIFICAR`, `ELIMINAR`)
- descripcion: text NOT NULL
- fecha_dia: date DEFAULT CURRENT_DATE
- fecha_hora: timestamp DEFAULT CURRENT_TIMESTAMP

## Relaciones y lógica
- Cada `partida` pertenece a una `categoria`.
- Cada `region` pertenece a un `pais`.
- Cada `precio` regional está vinculado a una `revision`, una `partida` y una `region` (aplica a los montos de Nuevos Proyectos, `monto_usd`).
- Los precios de O&M (`monto_om_1` y `monto_om_2`) se almacenan de forma global en la tabla `precios_om` (asociados a una `revision` y `partida`, pero independientes de la `region` o ciudad).
- Un `usuario` puede tener asignado un `pais` y/o una `region`.
- La tabla `historial_cambios` registra todas las acciones administrativas con fines de auditoría.


# Referencia de endpoints

## Autenticación
- `POST /auth/login`
  - body: `email`, `password`
  - devuelve: `token`, `perfil`

## Datos auxiliares
- `GET /data/auxiliar?token={token}`
  - devuelve países, regiones, revisiones, categorías, partidas y rol de usuario.

## PDF
- `GET /tabulador/ver-pdf`
  - query params:
    - `token`
    - `col_a_id`
    - `col_b_id` (opcional, `none` para ninguno)
    - `revision_id` (opcional)
    - `mostrar_np` (booleano)
    - `mostrar_om1` (booleano)
    - `mostrar_om2` (booleano)
  - respuesta: `application/pdf`

## Administración
- `POST /admin/usuarios?token={token}`
  - Crea un usuario. Exclusivo para Rol 4 (Súper Admin).
- `POST /admin/partidas?token={token}`
  - Crea una partida. Permitido para Roles 3, 4, 5.
- `PUT /admin/partidas/{partida_id}?token={token}`
  - Actualiza una partida. Permitido para Roles 3, 4, 5.
- `POST /admin/regiones?token={token}`
  - Crea una región/ciudad. Permitido para Roles 3, 4, 5.
- `POST /admin/paises?token={token}`
  - Crea un país con su base nacional. Permitido para Roles 3, 4, 5.
- `GET /admin/precios/matriz?token={token}&revision_id={rev}&region_id={region}`
  - Obtiene los precios de Nuevos Proyectos regionales y los O&M globales correspondientes a una revisión. Permitido para Roles 3, 4, 5.
- `POST /admin/precios/guardar?token={token}`
  - Guarda precios NP (`monto_usd`). Solo altera este monto según el rol: Rol 3 (solo NP) o Rol 4 (todo). Permitido para Roles 3, 4, 5.
- `GET /admin/precios/om?token={token}&revision_id={rev}`
  - Obtiene los precios O&M globales de una revisión. Permitido para Roles 3, 4, 5.
- `POST /admin/precios/om/guardar?token={token}`
  - Guarda precios O&M globales (`monto_om_1` y `monto_om_2`). Permitido para Roles 4 y 5.
- `POST /admin/revisiones/crear-borrador?token={token}`
  - Inicializa un borrador duplicando la última matriz publicada. Permitido para Roles 3, 4, 5.
- `POST /admin/revisiones/publicar?token={token}`
  - Publica el borrador actual y archiva la versión previa. Permitido para Roles 3, 4, 5.
- `POST /admin/revisiones/cancelar-borrador?token={token}`
  - Cancela y elimina el borrador activo junto con sus precios. Permitido para Roles 3, 4, 5.

## Auditoría (Historial de Cambios)
- `GET /admin/auditoria/fechas?token={token}`
  - Devuelve las fechas únicas con registros de cambios. Exclusivo para Rol 4.
- `GET /admin/auditoria/por-dia?fecha={fecha}&token={token}`
  - Devuelve los logs detallados de cambios para un día específico (YYYY-MM-DD). Exclusivo para Rol 4.

## Observaciones
- Los endpoints administrativos y de edición solo funcionan si el usuario tiene rol 3, 4 o 5.
- La creación de usuarios globales y la lectura del log de auditoría está restringida exclusivamente al Rol 4 (Súper Administrador).
- `crear-borrador` solo se puede ejecutar si no existe ya un borrador abierto en la tabla `revisiones`.
- `guardar_precios_simultaneos` y `guardar_precio_om` solo permiten editar precios de revisiones con estado `borrador`.
- `publicar_revision` solo permite publicar una revisión cuyo estado actual sea `borrador`.


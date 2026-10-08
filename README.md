# Campo Lindo Transaccional

Mercado agrícola experimental separado de la web analítica ODEPA. Implementa el flujo funcional de publicación, compra inmediata, pujas, órdenes de compra y trazabilidad de operaciones.

## Alcance del piloto

- 21 productos priorizados en Campo Lindo.
- Compra inmediata y subasta ascendente.
- Órdenes de compra publicadas por compradores.
- Lotes divisibles, cantidad mínima y adjudicación parcial.
- Perfiles verificados, reputación y ubicación general.
- Participantes identificados por nombre comercial, ubicación general, verificación e historial.
- Operaciones y eventos auditables.
- Supabase Auth, PostgreSQL, RLS y Storage preparados.
- Área privada **Mi mercado** para revisar publicaciones, pujas y operaciones reales.
- Mantenedor protegido para consolidar órdenes, participantes, pujas y negocios.
- Verificación administrativa de usuarios y control auditado de publicaciones.

Los pagos, garantías económicas y transporte no están activados en esta versión. El esquema deja estados y campos para incorporarlos después mediante proveedores externos.

## Desarrollo

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Si las tablas `market_*` todavía no existen, la interfaz pública entra en modo demostrativo. Las migraciones deben ejecutarse en este orden:

1. `supabase/migrations/202609290001_marketplace.sql`
2. `supabase/migrations/202610080001_market_admin.sql`

Después de ejecutar la segunda migración, active una sola cuenta propietaria desde el SQL Editor de Supabase:

```sql
update public.market_profiles p
set is_admin = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('CORREO_DEL_PROPIETARIO');
```

Rutas de la aplicación:

- `/` mercado público.
- `/cuenta/` publicaciones, pujas y operaciones del participante autenticado.
- `/admin/` mantenedor exclusivo para usuarios con `is_admin = true`.

## Seguridad

La aplicación usa solamente una clave publicable en el navegador. Nunca se debe incorporar una clave `secret` o `service_role` al repositorio o al frontend. Las operaciones críticas se ejecutan mediante funciones PostgreSQL con bloqueos de fila, políticas RLS, comprobación del rol administrador y bitácora `market_admin_audit`.

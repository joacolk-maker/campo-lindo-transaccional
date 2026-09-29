# Campo Lindo Transaccional

Mercado agrícola experimental separado de la web analítica ODEPA. Implementa el flujo funcional de publicación, compra inmediata, pujas, órdenes de compra y trazabilidad de operaciones.

## Alcance del piloto

- 21 productos priorizados en Campo Lindo.
- Compra inmediata y subasta ascendente.
- Órdenes de compra publicadas por compradores.
- Lotes divisibles, cantidad mínima y adjudicación parcial.
- Perfiles verificados, reputación y ubicación general.
- Compradores enmascarados durante la puja.
- Operaciones y eventos auditables.
- Supabase Auth, PostgreSQL, RLS y Storage preparados.

Los pagos, garantías económicas y transporte no están activados en esta versión. El esquema deja estados y campos para incorporarlos después mediante proveedores externos.

## Desarrollo

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Si las tablas `market_*` todavía no existen o no hay sesión iniciada, la interfaz entra en modo demostrativo. La migración completa está en `supabase/migrations/202609290001_marketplace.sql`.

## Seguridad

La aplicación usa solamente una clave publicable en el navegador. Nunca se debe incorporar una clave `secret` o `service_role` al repositorio o al frontend. Las operaciones críticas se ejecutan mediante funciones PostgreSQL con bloqueos de fila y políticas RLS.

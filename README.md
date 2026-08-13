# La Cocina de Isa CRM

CRM comercial para administrar clientes, pedidos, cobros, producción, reportes y la futura atención omnicanal de La Cocina de Isa.

## Activación inicial

1. Cree o seleccione el proyecto de Supabase y copie `.env.example` a `.env.local`.
2. Coloque la URL del proyecto y la clave pública de Supabase.
3. En **Supabase SQL Editor**, ejecute [la migración CRM](supabase/migrations/001_crm_comercial.sql). Es aditiva y conserva las tablas actuales.
4. Inicie la aplicación:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Los módulos nuevos están en Clientes, Conversaciones, Cobros y FEL, Reportes e Integraciones.

## Integraciones externas

- **Meta / WhatsApp**: cree una app Business en Meta Developers y use `https://TU-DOMINIO/api/webhooks/meta` como callback. Configure `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_ACCESS_TOKEN` y `META_WHATSAPP_PHONE_NUMBER_ID` solo en variables privadas. El webhook valida la firma y guarda los eventos recibidos en `integration_events`.
- **FEL Guatemala**: seleccione un certificador y configure `FEL_PROVIDER`, `FEL_API_URL` y `FEL_API_KEY`. La ruta `POST /api/fel/emitir` registra la factura y queda intencionalmente pendiente de un adaptador específico del certificador; no genera documentos fiscales simulados.
- **Vercel**: conecte el repositorio, copie las variables de `.env.local` en Project Settings → Environment Variables y despliegue. Nunca exponga `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_SECRET`, tokens de Meta ni claves FEL como `NEXT_PUBLIC_*`.

## Seguridad antes de producción

La aplicación actual todavía no tiene autenticación de Supabase. Antes de ponerla a disposición de terceros, implemente usuarios y roles y active RLS con políticas por rol para todas las tablas, incluidas las nuevas. Las integraciones de Meta y FEL se ejecutan exclusivamente en el servidor para no enviar secretos al navegador.

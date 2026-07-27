# CloverApp Panamá

Sistema de administración para ventas de lotería/números ("chance"). Monorepo con app móvil (Expo) y backend (NestJS + PostgreSQL).

## Estructura

```
apps/
  api/      Backend NestJS + Prisma + PostgreSQL
  mobile/   App Expo (Router) para vendedores/admins
```

## Roles

`super` · `admin` · `supervisor` · `vendedor`

## Requisitos

- Node.js 20+
- npm 10+ (workspaces)
- PostgreSQL 15+ (o cuenta en Supabase/Neon)
- Expo CLI (`npx expo`)

## Arranque rápido

```bash
npm install

# Backend
cp apps/api/.env.example apps/api/.env
npm run dev:api

# Mobile
npm run dev:mobile
```

## Estado del proyecto

Este es el esqueleto inicial: estructura de carpetas, configuración base y modelos de datos. **No contiene todavía lógica de negocio** (auth real, cálculo de premios, impresión Bluetooth, offline sync, etc.). Ver [NEXT_STEPS.md](./NEXT_STEPS.md) para el plan de implementación por módulo.

## Aviso legal

Este software administra dinero real asociado a un juego de números. Antes de operar con datos reales, verificar el cumplimiento con la regulación de juegos de azar vigente en Panamá (Junta de Control de Juegos o el organismo aplicable) y los requisitos de KYC/retención de auditoría que exija la licencia correspondiente.

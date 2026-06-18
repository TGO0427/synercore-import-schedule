# Synercore Platform Handover Inventory

Generated from the local repository and connected Vercel/database checks on 2026-06-15.

## Repository URLs

| System | Repository | Notes |
| --- | --- | --- |
| Import Platform | `git@github.com:TGO0427/synercore-import-schedule.git` | Main React/Vite frontend plus Node/Express backend. |
| Dispatch App | `git@github.com:TGO0427/synercore-import-schedule.git` | React Native/Expo app lives in `synercore-mobile/` inside the same repository. No separate local Git remote was found. |

## Vercel: Import Platform

| Item | Detail |
| --- | --- |
| Vercel owner/account | `Tino's projects` (`tinos-projects-54282c90`) |
| Project name | `synercore-import-schedule` |
| Project ID | `prj_ag1BjA0PsdLP7TQIET8t8cPziTs1` |
| Org/team ID | `team_AsPcat1OH5jUfmhFmDlER1b2` |
| Created | 2025-09-30 11:50:13 |
| Framework | Vite |
| Root directory | `.` |
| Node version | 22.x |
| Build command | `npm run build` or `vite build` |
| Linked local config | `.vercel/project.json` |

Vercel environment variables currently listed:

| Variable | Environments | Value |
| --- | --- | --- |
| `REACT_APP_SENTRY_DSN` | Development, Preview, Production | Encrypted |
| `DATABASE_URL` | Development, Preview, Production | Encrypted |
| `VITE_API_BASE_URL` | Development, Preview, Production | Encrypted |

## Railway: Backend and Database

Railway CLI is installed but this workstation is not currently logged in, so account/project names could not be confirmed by CLI.

Known local/deployment details:

| Item | Detail |
| --- | --- |
| Railway config | `railway.json` |
| Builder | Nixpacks `1.41.0` |
| Install command | `npm ci --include=dev` |
| Build command | `echo 'Server-only build - frontend built on Vercel'` |
| Start command | `npm run start` |
| Health check | `/health`, timeout 180 seconds |
| Restart policy | `ON_FAILURE`, max retries 3 |
| Backend URL referenced by frontend | `https://synercore-import-schedule-production.up.railway.app` |
| Database | PostgreSQL on Railway, accessed via `DATABASE_URL` |
| Production DB host observed locally | `centerbeam.proxy.rlwy.net:33680` |
| Database name/user observed locally | database `railway`, user `postgres` |

Sensitive note: the local `.env`, `migrate-production.ps1`, and `migrate-production.bat` contain a full Railway PostgreSQL connection string. Treat it as exposed and rotate it before sharing this handover outside the trusted admin group.

## Current User Access

### Import Platform Users

| Name / username | Email | Role | Created | Updated |
| --- | --- | --- | --- | --- |
| Valentino Gordon | `valentino@synercore.com` | admin | 2025-10-03 | 2025-10-20 |
| Abdurasiet Darries | `abdurasiet@synercore.co.za` | user | 2025-10-03 | 2025-10-03 |
| Darryn Loubser | `darryn@synercore.co.za` | user | 2025-10-03 | 2025-10-03 |
| Elize Nel | `elize@synercore.co.za` | user | 2025-10-03 | 2025-10-03 |
| Felicia Philander | `felicia@synercore.co.za` | user | 2025-10-03 | 2025-10-03 |
| HermanBester | `herman@synercore.co.za` | user | 2026-03-05 | 2026-03-05 |
| Liam Gordon | `liam@synercore.co.za` | user | 2025-10-03 | 2026-03-10 |
| Samantha Clarke | `samantha@synercore.co.za` | user | 2025-11-04 | 2025-11-04 |
| testuser | `test@example.com` | user | 2025-11-17 | 2025-11-17 |
| Vicky | `vicky@synercore.co.za` | user | 2026-03-05 | 2026-03-05 |
| Wayne Patton | `wayne@synercore.co.za` | user | 2025-10-03 | 2025-10-03 |
| Willem | no email set | user | 2025-10-20 | 2025-10-20 |

### Supplier / Portal Accounts

These accounts are in `supplier_accounts`, linked to suppliers. They appear to be supplier portal users rather than internal Import Platform users.

| Supplier | Email | Active | Created | Last login |
| --- | --- | --- | --- | --- |
| AB Mauri | `admin@ab.mauri.supplier` | yes | 2025-11-14 | none recorded |
| Deltaris | `admin@deltaris.supplier` | yes | 2025-11-14 | none recorded |
| HALAVET | `admin@halavet.supplier` | yes | 2025-11-14 | none recorded |
| QIDA CHEMICAL | `admin@qida.supplier` | yes | 2025-11-14 | 2025-11-14 |
| SHAKTI CHEMICALS | `shakti@example.com` | yes | 2025-11-14 | 2025-11-14 |

### Dispatch App Access

The Dispatch App (`synercore-mobile`) authenticates against the same backend auth endpoints and therefore uses the same main `users` table for app login. No separate Dispatch-specific user table was found in the repository.

## Synercore Data Flows

### Import Platform

Originating datasources:

| Data | Origin | Destination / use |
| --- | --- | --- |
| Shipment schedule rows | Manual entry or spreadsheet import in the web app | Stored in PostgreSQL `shipments`; displayed in schedule, dashboard, reports, warehouse views, and supplier portal. |
| Supplier master data | Web app supplier management and auto-created from imported shipment supplier names | Stored in `suppliers`; used for supplier matching, reporting, and supplier portal account links. |
| Warehouse capacity | Admin/user updates in the web app | Stored in `warehouse_capacity` and `warehouse_capacity_history`; used by warehouse dashboard and capacity reporting. |
| Post-arrival workflow | User actions in app: unloading, inspection, receiving, rejection/return | Updates workflow fields in `shipments`; may trigger notifications if email provider is configured. |
| File/archive data | Archive service for imported/archived shipment data | Used for archive screens and historical imports. |
| Users/auth | Admin-created app users and login/refresh flows | Stored in `users` and `refresh_tokens`; JWTs protect API access. |
| Supplier uploads | Supplier portal document upload flow | Stored as supplier document records/files; linked to shipments and supplier accounts. |

### Dispatch App

Originating data sources:

| Data | Origin | Destination / use |
| --- | --- | --- |
| Login/session | Mobile user enters credentials | Calls backend `/api/auth/login`; stores token locally via Expo secure/local storage helpers. |
| Shipment view/update data | Backend API | Reads and updates shipment records from the same PostgreSQL backend. |
| Warehouse/product endpoints | Backend API config includes product and warehouse endpoints | Uses same backend API base URL; current source config includes placeholder host and local `.env.local` override. |

Current mobile API configuration:

| Location | Value / note |
| --- | --- |
| `synercore-mobile/config/api.ts` | Placeholder `https://api.synercore.example.com` |
| `synercore-mobile/.env.local` | `EXPO_PUBLIC_API_URL=http://172.20.18.135:5001/api` for local development |

## Credentials and Integration Tokens Inventory

Raw secret values are intentionally not included here.

| Credential / token | Where referenced | Status / notes |
| --- | --- | --- |
| `DATABASE_URL` | `.env`, Vercel env, Railway env, migration helper scripts | Full credential is present locally in `.env` and migration scripts. Rotate before external sharing. |
| `JWT_SECRET` | `.env`, Railway env expected, backend auth/supplier controllers | Full local value is present in `.env`; used to sign app and supplier JWTs. Rotate if the repo/workstation was shared. |
| `JWT_REFRESH_SECRET` | `.env.example`, backend auth middleware | Optional; falls back to derived JWT secret if not set. Confirm in Railway. |
| `SETUP_TOKEN` | Backend `/api/auth/setup` route | Optional emergency/bootstrap token. Should normally be unset in production. |
| `REACT_APP_SENTRY_DSN` | Vercel env | Encrypted in Vercel; used for frontend error tracking docs/config. |
| `VITE_SENTRY_DSN` | `src/config/sentry.js`, `.env.example` | Expected by current Vite frontend code; Vercel currently lists `REACT_APP_SENTRY_DSN`, so confirm which variable is active after builds. |
| `SENTRY_DSN` | `server/config/sentry.js`, docs | Optional backend error tracking; not confirmed in Railway because CLI is not logged in. |
| `SENDGRID_API_KEY` | `server/services/emailService.ts`, docs | Supported but not found as a concrete local value. Confirm in Railway if email notifications are active. |
| SMTP credentials | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` in email service/docs | Supported but not found as concrete local values. Confirm in Railway. |
| IMAP credentials | `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_HOST` in docs/importer | Email importer support exists; no concrete local production values found. |
| Google Analytics | `VITE_GA_ID` / `VITE_GA_MEASUREMENT_ID` in `src/config/analytics.js` | Supported by code, not listed in Vercel env output. |
| Expo public API URL | `EXPO_PUBLIC_API_URL` in mobile services | Local dev value exists in `synercore-mobile/.env.local`; not a secret, but environment-specific. |
| Claude / Anthropic API key | Search for `CLAUDE`, `ANTHROPIC`, `OPENAI` | No API key reference found in app code/env. `.claude/settings.local.json` exists as local tool settings only. |
| ngrok token | `scripts/setup-ngrok.sh` prompts for token | No concrete token found in repo search. |

## Items To Confirm With Account Owners

1. Railway account owner, project name, service IDs, and current Railway environment variables via `railway login` and `railway variables`.
2. Whether Vercel should use `VITE_SENTRY_DSN` instead of or in addition to `REACT_APP_SENTRY_DSN`.
3. Whether the `testuser` and supplier demo-style emails should remain active in production.
4. Whether the Dispatch App has a separate Expo/EAS account, build profile, or app store distribution not present in this repository.
5. Rotate the exposed Railway database URL and local JWT secret if this handover is going beyond the current trusted admin machine.

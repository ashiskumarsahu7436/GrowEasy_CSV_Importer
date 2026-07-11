---
name: GrowEasy CSV Importer deploys to Render, not Replit
description: This project's production target is Render; do not configure Replit Deployments for it.
---

The user develops this app on Replit but deploys to Render as a single web service (frontend build + backend served from one Express process). Do not set up or suggest Replit Deployments for it.

**Why:** explicit user preference — Render env vars (e.g. `GROQ_API_KEY`) are configured separately at Render deploy time, not via Replit's deployment secrets flow.

**How to apply:** keep Replit dev workflows running for live iteration/preview only. If asked to "deploy" or "publish" this project, confirm whether they mean Render (point to README's "Deploying to Render" section) before touching Replit Deployments.

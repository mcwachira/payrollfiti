---
title: "PayrollFiti — Complete Build Guide"
author: "Engineering Reference"
date: "August 2026"
---

**A step-by-step engineering reference for building a multi-country, multi-tenant payroll & HR SaaS platform from scratch.**

This guide documents the full architecture of PayrollFiti exactly as implemented: a Turborepo monorepo with a Next.js 15 frontend, a NestJS backend, a PostgreSQL database via Prisma, a pure-function multi-country payroll calculation engine, Paystack and M-Pesa payment integrations, BullMQ background jobs, and a complete set of HR features (leave, loans, attendance, documents, compliance reporting).

It is written to be followed in order — each part builds on the ones before it, the same way the real system was built: schema first, then the pure calculation core, then the API layer, then the integrations, then the UI.

**Covers:** monorepo scaffolding · database schema · the payroll calculation engine (Kenya, Nigeria, South Africa) · authentication & multi-tenancy · RBAC · core payroll API · compliance reports · billing (Paystack & M-Pesa) · notifications & background jobs · leave, loans, attendance, documents · frontend architecture · testing · DevOps & deployment · employee onboarding, login & password reset · the installable PWA and web push notifications.

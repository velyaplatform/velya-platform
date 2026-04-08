# ADR-0002: TypeScript/Node.js with NestJS and Next.js

## Status
Accepted

## Date
2026-04-08

## Context
We need a consistent language and framework stack across the entire platform to maximize code reuse and minimize context-switching. The platform requires server-side APIs, real-time event processing, a modern web frontend, and AI agent orchestration. Choosing different languages for frontend and backend would fragment the team's expertise and prevent sharing domain models, validation logic, and type definitions.

## Decision
We will use TypeScript as the single language across the entire platform. Backend services will be built with NestJS 11, which provides dependency injection, module organization, and first-class support for microservices patterns (gRPC, NATS, WebSockets). Frontend applications will use Next.js 15 with the App Router for server-side rendering, API routes, and React Server Components. The runtime is Node.js 22 LTS with TypeScript 5.7+. Shared domain types, validators, and utilities live in `packages/` and are consumed by both frontend and backend.

## Consequences

### Positive
- Single language across the stack eliminates context-switching and enables full-stack developers
- Shared TypeScript interfaces for FHIR resources, events, and API contracts catch integration errors at compile time
- NestJS module system maps cleanly to domain-driven design bounded contexts
- Next.js App Router provides server components, streaming, and partial prerendering for healthcare UIs that need fast time-to-interactive

### Negative
- Node.js single-threaded model requires careful handling of CPU-intensive operations (offload to worker threads or separate services)
- TypeScript compilation adds build complexity and requires strict tsconfig management across workspaces

### Risks
- NestJS abstraction overhead may be excessive for simple CRUD services
- Mitigation: Use lightweight NestJS modules for simple services; reserve full DI patterns for complex domain logic

## Alternatives Considered
- **Go for backend services**: Rejected because it would split the codebase into two languages, prevent sharing FHIR type definitions, and require maintaining separate CI toolchains
- **Python/FastAPI for backend**: Rejected for the same language fragmentation reasons; Python's type system is also less mature than TypeScript for large-scale applications
- **Remix or SvelteKit for frontend**: Rejected in favor of Next.js due to Next.js's larger ecosystem, Vercel-backed support, and stronger adoption in healthcare/enterprise applications

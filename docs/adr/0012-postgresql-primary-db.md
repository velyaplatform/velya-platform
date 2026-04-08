# ADR-0012: PostgreSQL as Primary Database

## Status

Accepted

## Date

2026-04-08

## Context

The platform requires a relational database for application state, user accounts, tenant configuration, audit logs, and as the persistence backend for Medplum (FHIR server) and Temporal (workflow engine). The database must support ACID transactions, complex queries, JSON document storage, full-text search, and row-level security. It must be available as a managed service on AWS with automated backups, point-in-time recovery, encryption at rest, and cross-AZ replication for high availability in a healthcare context.

## Decision

We will use PostgreSQL 16 as the primary relational database for all platform services. AWS RDS for PostgreSQL will be used in staging and production with Multi-AZ deployment, automated backups with 30-day retention, and encryption at rest via AWS KMS. Each service owns its own database (schema-per-service or database-per-service depending on isolation requirements). Medplum uses a dedicated PostgreSQL database for FHIR resource storage. Temporal uses a dedicated PostgreSQL database for workflow persistence. For local development, PostgreSQL runs in Docker via docker-compose.

## Consequences

### Positive

- PostgreSQL's JSONB type enables flexible document storage alongside relational data, supporting FHIR resource extensions and agent configuration without schema migration
- Row-level security (RLS) provides database-enforced multi-tenancy, preventing cross-tenant data leakage even if application code has bugs
- AWS RDS handles replication, backups, patching, and failover, reducing operational burden for a healthcare-critical data store
- Mature ecosystem of extensions (pg_cron, pgvector, PostGIS) provides capabilities that would otherwise require additional infrastructure

### Negative

- PostgreSQL's single-writer architecture limits horizontal write scaling; very high write throughput scenarios may require sharding or CQRS patterns
- Managing multiple databases (service DBs + Medplum + Temporal) increases backup complexity and monitoring surface area

### Risks

- RDS costs can escalate with large instance types and high IOPS requirements, especially with Medplum's FHIR storage patterns
- Mitigation: Use RDS Graviton instances for cost efficiency, implement connection pooling via PgBouncer, and monitor query performance with pg_stat_statements to prevent expensive query patterns

## Alternatives Considered

- **MySQL/Aurora MySQL**: Rejected because PostgreSQL's JSONB support, CTEs, window functions, and extension ecosystem are significantly more mature; Aurora's proprietary storage engine also introduces vendor lock-in
- **MongoDB**: Rejected because healthcare data requires transactional consistency that MongoDB's eventual consistency model does not guarantee by default; also, FHIR resources map well to PostgreSQL's JSONB type
- **CockroachDB**: Rejected due to cost and complexity; CockroachDB's distributed SQL is overkill for Velya's current scale, and its PostgreSQL compatibility is not 100%
- **DynamoDB**: Rejected because DynamoDB's key-value model does not support the complex relational queries needed for clinical data, audit trails, and workflow state

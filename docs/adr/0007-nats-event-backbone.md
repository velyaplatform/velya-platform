# ADR-0007: NATS for Event-Driven Messaging

## Status
Accepted

## Date
2026-04-08

## Context
The platform requires an event backbone for asynchronous communication between services, agents, and platform components. Clinical events (patient admitted, lab result received, care plan updated) must flow reliably between bounded contexts without tight coupling. The messaging system must support publish-subscribe, request-reply, queue groups for load balancing, and persistent streams for event replay. It must be operationally simple, high-performance, and deployable on Kubernetes with minimal overhead.

## Decision
We will use NATS 2.10+ with JetStream enabled as the event-driven messaging backbone. NATS provides core pub/sub, request-reply, and queue groups with sub-millisecond latency. JetStream adds persistent streams with at-least-once delivery, consumer groups, key-value store, and object store capabilities. NATS will be deployed as a 3-node cluster in each EKS cluster using the official NATS Helm chart. Services will publish domain events to subject hierarchies (e.g., `clinical.patient.admitted`, `clinical.lab.resulted`) and consume them via durable JetStream consumers.

## Consequences

### Positive
- NATS is a single binary with zero external dependencies, making it operationally trivial compared to Kafka or RabbitMQ
- JetStream provides exactly the durability guarantees needed without Kafka's operational complexity (ZooKeeper/KRaft, partition management, consumer group rebalancing)
- Subject-based addressing with wildcards (`clinical.>`, `clinical.patient.*`) enables flexible event routing without topic proliferation
- Built-in request-reply pattern supports synchronous-style RPC over the same infrastructure

### Negative
- NATS JetStream is less battle-tested at extreme scale (millions of messages/second) compared to Kafka
- Fewer third-party connectors and ecosystem integrations compared to Kafka Connect

### Risks
- JetStream's stream retention and replay capabilities are less mature than Kafka's log compaction for event sourcing patterns
- Mitigation: Use JetStream for event-driven messaging and Temporal for durable workflow state; avoid using JetStream as a primary event store

## Alternatives Considered
- **Apache Kafka**: Rejected due to operational complexity (KRaft cluster management, partition rebalancing, consumer group coordination) and resource overhead for a platform that does not require Kafka-scale throughput
- **RabbitMQ**: Rejected because RabbitMQ's queue-based model is less suitable for pub/sub event broadcasting, and its clustering/HA model is more fragile than NATS
- **AWS SQS/SNS**: Rejected due to vendor lock-in and the need for a self-hosted solution that runs identically in dev, staging, and production environments
- **Redis Streams**: Rejected because Redis is not purpose-built for messaging; its stream implementation lacks consumer group semantics as robust as JetStream's

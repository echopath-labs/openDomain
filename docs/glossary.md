# Glossary

## Bounded Context

A business boundary where a concept has a specific meaning. The same word may
mean different things in different contexts.

## Domain Concept

A durable business concept such as Customer, Order, Supplier, Warehouse, Work
Order, or Invoice.

## Business Rule

A business invariant, policy, constraint, exception, or definition that agents
must respect when changing software.

## Lifecycle

The states and transitions that govern a domain object over time.

## Domain Event

A business fact that has happened, such as OrderConfirmed or InvoiceIssued.

## Evidence

The source that supports a domain claim, such as human review, tests, code, API,
database schema, ADR, OpenSpec, commit, or user story.

## Domain Candidate

A proposed domain knowledge change created by an agent or human before it is
accepted, rejected, superseded, or deprecated.

## Review State

The governance state for domain knowledge: proposed, accepted, rejected,
superseded, or deprecated.

## Grounding Request

A versioned, tool-neutral request that identifies external work intent and the
accepted OpenDomain IDs it declares as affected.

## Grounding Pack

A versioned read-first result containing accepted source pointers, separate
Candidate boundaries, advisory context cost, and diagnostics. It is not source
of truth.

## Semantic Closure

The deterministic, cycle-safe expansion from declared accepted roots through a
versioned allowlist of structured OpenDomain references.

## Context Budget

An advisory estimate of complete accepted and optional Candidate source cost.
It never changes which semantics are required.

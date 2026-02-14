# JobBobber Documentation

Welcome to the JobBobber documentation! This directory contains detailed technical documentation, architecture guides, and development resources.

## Documentation Overview

### Core Documents (Project Root)

| Document | Description |
|----------|-------------|
| **[README.md](../README.md)** | Main project overview, business model, and getting started guide |
| **[PRD.md](../PRD.md)** | Complete Product Requirements Document with detailed specifications |
| **[CLAUDE.md](../CLAUDE.md)** | Claude Code preferences and development workflow |
| **[project-config.json](../project-config.json)** | Machine-readable tech stack and configuration |
| **[.gitignore](../.gitignore)** | Git ignore patterns for the project |

### Technical Documentation (/docs)

| Document | Description |
|----------|-------------|
| **[AGENT_ARCHITECTURE.md](AGENT_ARCHITECTURE.md)** | AI agent system architecture, patterns, and implementation guide |
| **[ROADMAP.md](ROADMAP.md)** | Detailed feature roadmap organized by phase (MVP → Beta → Full) |
| **[README.md](README.md)** | This file - documentation index |

### Configuration Files (/.)claude)

| File | Description |
|------|-------------|
| **[.claude/settings.json](../.claude/settings.json)** | Claude Code project settings (permissions, hooks, env vars) |
| **[.claude/rules.md](../.claude/rules.md)** | Project-specific coding patterns and best practices |

## Quick Navigation

### For Business Understanding
1. Start with [../README.md](../README.md) for high-level overview
2. Read [../PRD.md](../PRD.md) for complete product requirements
3. Review [ROADMAP.md](ROADMAP.md) for feature breakdown by phase

### For Technical Implementation
1. Review [../project-config.json](../project-config.json) for tech stack
2. Read [AGENT_ARCHITECTURE.md](AGENT_ARCHITECTURE.md) for agent system design
3. Check [../.claude/rules.md](../.claude/rules.md) for coding patterns

### For Development Setup
1. Follow [../README.md#getting-started](../README.md#getting-started) for installation
2. Configure environment variables as per [../README.md#configuration](../README.md#configuration)
3. Review [CLAUDE.md](../CLAUDE.md) for Claude Code workflow

## Documentation Standards

### When to Update

- **README.md**: Update when architecture decisions or tech stack changes
- **PRD.md**: Update when product requirements change (version and track changes)
- **ROADMAP.md**: Update when features are added, removed, or re-prioritized
- **AGENT_ARCHITECTURE.md**: Update when agent patterns or architecture evolves
- **project-config.json**: Update when tech stack or commands change

### How to Update

1. Read the existing document first to understand current state
2. Make changes with clear, concise language
3. Update "Last Updated" date at bottom of document
4. Increment version number if significant changes (e.g., 0.1.0 → 0.2.0)
5. Commit with descriptive message: `docs: update ROADMAP with Q2 features`

## Contributing to Documentation

Good documentation:
- ✅ Is clear and concise
- ✅ Uses examples and code snippets
- ✅ Stays up-to-date with the codebase
- ✅ Includes diagrams where helpful
- ✅ Is organized logically

Poor documentation:
- ❌ Is vague or ambiguous
- ❌ Goes stale and contradicts the code
- ❌ Uses jargon without explanation
- ❌ Is disorganized or hard to navigate

## Questions?

If you can't find what you're looking for, check:
1. GitHub Discussions for Q&A
2. PRD.md for product-specific questions
3. AGENT_ARCHITECTURE.md for technical questions
4. .claude/rules.md for coding pattern questions

---

**Last Updated**: 2026-02-14

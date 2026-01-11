# GitHub Copilot Instructions for GardenCAD

## ⚠️ CRITICAL: Always Start Chat Sessions With Context

**Before any implementation work, the developer MUST explicitly state:**

1. **Which slice** they are working on (e.g., "I'm working on slice-05-drawing-tools")
2. **Which branch** they are on (e.g., "on branch slice-05-drawing-tools")
3. **Current status** (e.g., "starting from scratch" or "continuing from previous session")

**Example session start:**
```
User: "I'm implementing slice-05-drawing-tools on branch slice-05-drawing-tools, starting fresh"
```

**If the user doesn't provide this context, politely ask them to specify:**
- Which slice number and description they're working on
- What branch they've created
- Whether they're starting fresh or continuing work

## Git Workflow Rules

### Branch Strategy
- **ALWAYS** work on `slice-NN-description` branches
- **NEVER** commit directly to `main` branch
- **NEVER** create branches with other naming patterns unless explicitly for hotfixes

### Branch Creation
When starting a new slice:
```bash
git checkout main
git pull origin main
git checkout -b slice-NN-description
```

### Commit Messages
Use consistent prefix format:
```
slice-NN: descriptive message about the change
```

Examples:
- `slice-01: Add vite config and package.json`
- `slice-05: Implement circle drawing tool`
- `slice-10: Add polyline geometry model`

### Before Implementation
Always verify:
1. User is on the correct `slice-NN` branch
2. Branch was created from latest `main`
3. The slice plan is referenced from `docs/ELEPHANT_CARPACCIO_SLICE_PLAN.md`

## Implementation Guidelines

### Follow the Slice Plan
- Reference `docs/ELEPHANT_CARPACCIO_SLICE_PLAN.md` for implementation details
- Each slice is a complete, testable increment
- Don't skip ahead to future slices
- Don't implement features not in the current slice

### Code Organization
- Use TypeScript for all code
- Follow the project structure: `src/` for source files
- Organize by domain: `src/viewport/`, `src/geometry/`, `src/tools/`, `src/renderer/`
- Create tests alongside implementation

### Testing
- Write tests for each slice
- Ensure tests pass before suggesting merge
- Test manually in the browser when appropriate

### Documentation
- Update README.md if user-facing changes occur
- Add JSDoc comments for public APIs
- Keep code self-documenting with clear variable names

## Slice-Specific Context

When working on a slice, reference its specific requirements:

**Slices 1-5 (Foundation):**
- Focus on minimal, working implementations
- Prioritize getting something visible in the browser
- Use Vite for dev server, vanilla TypeScript

**Slices 6-10 (Core Features):**
- Build on existing foundation
- Ensure interoperability between features
- Focus on user interaction quality

**Slices 11-15 (Advanced Tools):**
- Complex geometry and interactions
- Performance considerations start to matter
- May require refactoring of earlier slices

**Slices 16-20 (Polish & Mobile):**
- UI/UX refinement
- Mobile-specific considerations
- Performance optimization critical

## Pull Request Checklist

Before suggesting the user creates a PR, verify:
- [ ] All files are committed with `slice-NN:` prefix
- [ ] Tests written and passing
- [ ] Code follows TypeScript best practices
- [ ] No console.log debugging statements left in code
- [ ] Branch is up to date with main
- [ ] User has manually tested the implementation

## Communication Style

- Be concise and direct
- Reference specific files and line numbers when discussing code
- Suggest complete, working implementations, not pseudocode
- When creating files, use absolute paths
- Explain *why* for architectural decisions, not just *what*

## Workflow Reference

Full workflow details in: `docs/GIT_WORKFLOW.md`

## Session Startup Template

At the start of each session, confirm:
```
Working on: slice-NN-description
Branch: slice-NN-description  
Status: [starting fresh / continuing / ready for PR]
Reference: docs/slices/slice-NN-description.md
```

If this context is missing, request it before proceeding with implementation.

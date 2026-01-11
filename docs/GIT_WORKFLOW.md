# Git Workflow Guide

## Branch Strategy: Trunk-Based Development

This project uses **trunk-based development** with short-lived feature branches aligned to the Elephant Carpaccio implementation slices.

### Branch Structure

**Main branches:**
- `main` - Always deployable, protected, represents the latest stable state
- `release/v*` - Created from main when preparing releases (e.g., `release/v1.0`, `release/v2.0`)

**Short-lived feature branches:**
- `slice-NN-description` - One branch per carpaccio slice (e.g., `slice-01-bootstrap-dev-environment`)

### Branch Naming Convention

```
slice-NN-short-description
```

Examples:
- `slice-01-bootstrap-dev-environment`
- `slice-02-svg-viewport-foundation`
- `slice-05-drawing-tools`
- `slice-10-polyline-polygon-tools`

### Workflow for Each Slice

#### 1. Start a New Slice

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Create new slice branch
git checkout -b slice-NN-description
```

#### 2. Implement the Slice

- Work on the slice implementation
- Commit frequently with descriptive messages
- Use commit prefix: `slice-NN: your message`

Example commits:
```
slice-01: Add package.json and vite config
slice-01: Create index.html with SVG viewport
slice-01: Add TypeScript entry point
```

#### 3. Push and Create Pull Request

```bash
# Push branch
git push origin slice-NN-description

# Create PR with title format:
# "Slice NN: Description"
```

#### 4. Merge to Main

- Ensure tests pass
- Get review approval (if working in team)
- Merge to main (squash or merge commit based on preference)
- Delete feature branch after merge

```bash
# After merge, clean up
git checkout main
git pull origin main
git branch -d slice-NN-description
```

### Release Process

#### Creating a Release

When ready to create a release (e.g., after completing slices 5, 10, 15, or 20):

```bash
# From main
git checkout main
git pull origin main

# Create release branch
git checkout -b release/v1.0

# Apply any final polish, version bumps, changelog updates
git commit -m "Prepare release v1.0.0"

# Tag the release
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push branch and tag
git push origin release/v1.0
git push origin v1.0.0
```

#### Hotfixes

If bugs are found in a release:

```bash
# Create hotfix from release branch
git checkout release/v1.0
git checkout -b hotfix-v1.0.1

# Fix the bug
git commit -m "Fix: description of fix"

# Merge back to release branch
git checkout release/v1.0
git merge hotfix-v1.0.1
git tag -a v1.0.1 -m "Hotfix release 1.0.1"

# Cherry-pick or merge to main
git checkout main
git cherry-pick <commit-hash>
# or
git merge hotfix-v1.0.1
```

### Commit Message Convention

Use clear, descriptive commit messages with slice prefix:

```
slice-NN: Add feature X
slice-NN: Fix bug in Y
slice-NN: Refactor Z for clarity
```

For non-slice commits:
```
docs: Update README with installation steps
chore: Update dependencies
fix: Correct typo in error message
```

### Protection Rules

**For main branch:**
- Require pull request reviews
- Require status checks to pass (tests, linting)
- Prevent direct commits
- Require branches to be up to date before merging

**For release/* branches:**
- Prevent direct commits
- Require pull request reviews for hotfixes

### Planned Release Milestones

Suggested release points based on slice completion:

- **v0.1.0** (MVP) - After slice 5: Basic drawing tools
- **v1.0.0** (Core) - After slice 10: Layers, persistence, polygons
- **v2.0.0** (Advanced) - After slice 15: Advanced snapping, undo/redo, bezier curves
- **v3.0.0** (Full) - After slice 20: PWA, mobile, camera measurements

### Tips for Success

1. **Keep branches short-lived**: Merge slices within 1-2 days to avoid drift
2. **One slice at a time**: Focus on completing one slice before starting the next
3. **Test before merging**: Ensure all tests pass and the slice is complete
4. **Update main frequently**: Pull from main regularly to stay in sync
5. **Clear PR descriptions**: Reference the slice document and describe what was implemented

### CI/CD Integration

All branches should:
- Run automated tests
- Run linting/formatting checks
- Build successfully
- Pass type checking (TypeScript)

The `main` branch should additionally:
- Deploy to staging/preview environment
- Run integration tests
- Update documentation site

### Questions?

If you're unsure about the workflow:
1. Consult this document
2. Check the slice plan in `docs/ELEPHANT_CARPACCIO_SLICE_PLAN.md`
3. Review recent merged PRs for examples

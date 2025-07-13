# Contribute Guide

> [!IMPORTANT]  
> I wrote this app when I was learning to code, so the code is far from good. I have been trying to refactor the code and implement better storage methods considering future updates.

## Introduction

Welcome to the contribute guide for Yomikiru. This guide will help you understand how to contribute to the project effectively.

## Prerequisites

Before you start contributing, make sure you have:

- Basic knowledge of Git and GitHub
- Familiarity with TypeScript, React, and Electron
- A GitHub account
- **Actually use this application and know what it does**

For technical setup requirements, see the [Build Guide](./build.md#prerequisites).

## Code of Conduct

Please review our [Code of Conduct](../CODE_OF_CONDUCT.md) before contributing to the project.

## Getting Started

### 1. Development Setup

1. Fork the repository on GitHub
2. Clone the forked repository to your local machine
3. Follow the [Build Guide](./build.md) for complete setup instructions
4. Create a new branch for your changes: `git checkout -b feat/your-feature` (or `fix/your-fix` if it's a bug fix)

### 2. Development Workflow

```bash
# Start development server
pnpm dev

# Run code quality checks
pnpm lint
```

For detailed development workflow, debugging tips, and troubleshooting, see the [Development Workflow](./build.md#development-workflow) section in the build guide.

### 3. Code Guidelines

- Follow bulletproof-react concepts
- Use `type` instead of `interface` in TypeScript unless required
- Use transactions when needed in Drizzle
- Never use `any` type unless required.
- Follow the existing code style and patterns

## Filing Pull Requests

### Before Submitting

1. **Test thoroughly** on your target platform
2. **Run quality checks**: `pnpm lint`
3. **Update documentation**: Add/edit relevant docs and `Usage.tsx` if needed
4. **Verify cross-platform compatibility** when possible

### PR Guidelines

- **Target branch**: Submit PRs to the `beta` branch (or `master` if it's a bug fix)
- **Commit messages**: Use descriptive, conventional commit format
- **PR title**: Clear and descriptive
- **Description**: Explain what changes were made and why
- **Breaking changes**: Clearly indicate if changes break existing functionality
- **Version bumping**: Do not bump version numbers (maintainers will handle this)

### Testing Checklist

- [ ] App builds successfully (`pnpm package`)
- [ ] No linting errors (`pnpm lint`)
- [ ] Database migrations work correctly
- [ ] Feature works as expected
- [ ] No console errors in development
- [ ] Tested on target platform(s)

## Development Tips

- Use the [Troubleshooting guide](./build.md#troubleshooting) for common issues
- Check `logs/main.log` in userData directory for detailed errors
- Use `pnpm drizzle:studio` or any other database viewer to inspect database changes during development
- Enable hardware acceleration for better performance during testing
- Use portable mode to avoid affecting your personal data

## What Not to Include

- Content that may result in copyright issues
- Breaking changes without prior discussion
- Major architectural changes without approval
- Features that significantly impact performance
- Code that doesn't follow the established patterns

## Getting Help

- **Issues**: Use GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub discussions for general questions
- **Build problems**: Check the [Build Guide](./build.md) first
- **Contact**: Reach out to maintainers for major contributions

## Recognition

All contributors will be acknowledged in the project. Thank you for helping make Yomikiru better!

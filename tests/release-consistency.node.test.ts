/**
 * @file    tests/release-consistency.node.test.ts
 * @description
 *   Mechanical release consistency test suite verifying alignment across:
 *   - package.json
 *   - package-lock.json
 *   - README.md (release badge & roadmap entry)
 *   - README_CN.md (release badge & roadmap entry)
 *   - ROADMAP.md
 *   - NEXT_STEPS.md
 *   - CHANGELOG.md
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Release Version Alignment & Checklist Guard', () => {
  const rootDir = path.resolve(import.meta.dirname, '..');

  const pkgPath = path.join(rootDir, 'package.json');
  const pkgLockPath = path.join(rootDir, 'package-lock.json');
  const readmePath = path.join(rootDir, 'README.md');
  const readmeCnPath = path.join(rootDir, 'README_CN.md');
  const roadmapPath = path.join(rootDir, 'ROADMAP.md');
  const nextStepsPath = path.join(rootDir, 'NEXT_STEPS.md');
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const currentVersion = pkg.version;

  it('1. verifies package.json has a valid semver version', () => {
    assert.ok(currentVersion, 'package.json must declare a version');
    assert.match(
      currentVersion,
      /^\d+\.\d+\.\d+/,
      `Expected valid semver, got ${currentVersion}`,
    );
  });

  it('2. verifies package-lock.json matches package.json version exactly', () => {
    assert.ok(fs.existsSync(pkgLockPath), 'package-lock.json must exist');
    const pkgLock = JSON.parse(fs.readFileSync(pkgLockPath, 'utf-8'));
    assert.strictEqual(
      pkgLock.version,
      currentVersion,
      `package-lock.json version (${pkgLock.version}) must match package.json (${currentVersion})`,
    );
    if (pkgLock.packages && pkgLock.packages['']) {
      assert.strictEqual(
        pkgLock.packages[''].version,
        currentVersion,
        `package-lock.json root package version (${pkgLock.packages[''].version}) must match package.json (${currentVersion})`,
      );
    }
  });

  it('3. verifies README.md contains current version badge and roadmap entry', () => {
    assert.ok(fs.existsSync(readmePath), 'README.md must exist');
    const content = fs.readFileSync(readmePath, 'utf-8');
    const badgePattern = `badge/version-v${currentVersion}-blue.svg`;
    assert.ok(
      content.includes(badgePattern),
      `README.md must contain version badge: ${badgePattern}`,
    );
    assert.ok(
      content.includes(`v${currentVersion}`),
      `README.md must reference v${currentVersion}`,
    );
  });

  it('4. verifies README_CN.md contains current version badge and roadmap entry', () => {
    assert.ok(fs.existsSync(readmeCnPath), 'README_CN.md must exist');
    const content = fs.readFileSync(readmeCnPath, 'utf-8');
    const badgePattern = `badge/版本-v${currentVersion}-blue.svg`;
    assert.ok(
      content.includes(badgePattern),
      `README_CN.md must contain Chinese version badge: ${badgePattern}`,
    );
    assert.ok(
      content.includes(`v${currentVersion}`),
      `README_CN.md must reference v${currentVersion}`,
    );
  });

  it('5. verifies ROADMAP.md contains current release entry', () => {
    assert.ok(fs.existsSync(roadmapPath), 'ROADMAP.md must exist');
    const content = fs.readFileSync(roadmapPath, 'utf-8');
    assert.ok(
      content.includes(`v${currentVersion}`),
      `ROADMAP.md must include entry for v${currentVersion}`,
    );
  });

  it('6. verifies NEXT_STEPS.md current version matches', () => {
    assert.ok(fs.existsSync(nextStepsPath), 'NEXT_STEPS.md must exist');
    const content = fs.readFileSync(nextStepsPath, 'utf-8');
    assert.ok(
      content.includes(`v${currentVersion}`),
      `NEXT_STEPS.md must include entry for v${currentVersion}`,
    );
  });

  it('7. verifies CHANGELOG.md contains release notes heading for current version', () => {
    assert.ok(fs.existsSync(changelogPath), 'CHANGELOG.md must exist');
    const content = fs.readFileSync(changelogPath, 'utf-8');
    const changelogHeader = `## [${currentVersion}]`;
    assert.ok(
      content.includes(changelogHeader),
      `CHANGELOG.md must contain section header: ${changelogHeader}`,
    );
  });
});

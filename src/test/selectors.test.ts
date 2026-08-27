import { describe, expect, it } from 'vitest';
import { demoState } from '../domain/fixtures';
import { selectDashboardSummary, selectEnterpriseRows, selectModeVolume, selectObjectProgress, selectPlatformOverview, selectProjectRows, selectProviderRows, selectRoleVisibleRecords, selectServiceQueue, selectTimeline } from '../domain/selectors';
import type { Actor } from '../domain/types';

const owner: Actor = { userId: 'user-enterprise-owner', organizationId: 'org-enterprise-wenzhou', projectIds: ['project-wenzhou'], role: 'enterprise_owner' };
const provider: Actor = { userId: 'user-provider', organizationId: 'org-service-provider', projectIds: ['project-wenzhou'], role: 'service_provider' };
const platform: Actor = { userId: 'user-platform-operator', organizationId: 'org-platform', projectIds: ['project-wenzhou', 'project-nanjing'], role: 'platform_operator' };

describe('pure state selectors', () => {
  it('derives dashboard counts and distinct product progress', () => {
    const summary = selectDashboardSummary(demoState, owner);
    expect(summary.pendingTasks).toBeGreaterThan(0);
    expect(summary.openRisks).toBe(1);
    const progress = selectObjectProgress(demoState, 'Product', 'product-demo', owner);
    expect(progress.lifecycle).toBe('草稿');
    expect(progress.content).toBe('待确认');
    expect(progress.compliance).toBe('待整改');
    expect(progress.channel).toBe('待发布');
  });

  it('limits provider records to assigned work', () => {
    const visible = selectRoleVisibleRecords(demoState, provider);
    expect(visible.products).toHaveLength(0);
    expect(visible.complianceCases).toHaveLength(1);
    expect(visible.tasks.every((item) => item.assigneeId === provider.userId)).toBe(true);
  });

  it('builds an ordered object timeline from scenes, audit, and tasks', () => {
    const timeline = selectTimeline(demoState, 'Product', 'product-demo', owner);
    expect(timeline.map((item) => item.kind)).toEqual(expect.arrayContaining(['scene', 'audit', 'task']));
    expect(timeline.map((item) => item.at)).toEqual([...timeline].sort((a, b) => a.at.localeCompare(b.at)).map((item) => item.at));
  });

  it('counts only records inside the actor project and organization scope', () => {
    const otherTenant = { ...owner, organizationId: 'org-enterprise-nanjing', projectIds: ['project-nanjing'] };
    const summary = selectDashboardSummary(demoState, otherTenant);
    expect(summary.products).toBe(0);
    expect(summary.openRisks).toBe(0);
    expect(summary.pendingTasks).toBe(0);
  });

  it('does not expose records to a forged or disabled actor', () => {
    const forged = selectRoleVisibleRecords(demoState, { ...owner, role: 'platform_operator', organizationId: 'org-platform', projectIds: ['project-nanjing'] });
    expect(forged.products).toHaveLength(0);
    const disabled = selectRoleVisibleRecords(demoState, { ...owner, userId: 'user-disabled' });
    expect(disabled.products).toHaveLength(0);
  });

  it('derives platform overview only for the platform operator', () => {
    const overview = selectPlatformOverview(demoState, platform);
    expect(overview.enterprises).toBe(2);
    expect(overview.admissions).toBe(1);
    expect(overview.providers).toBe(2);
    expect(overview.pendingServices).toBeGreaterThan(0);
    expect(overview.projects).toBe(2);
    expect(overview.modes).toEqual(expect.arrayContaining(['9810', '9710', '1039']));
    expect(selectPlatformOverview(demoState, owner).enterprises).toBe(0);
  });

  it('lists platform enterprise rows with per-organization counts', () => {
    const rows = selectEnterpriseRows(demoState, platform);
    const ningbo = rows.find((row) => row.id === 'org-enterprise-ningbo');
    expect(rows).toHaveLength(3);
    expect(ningbo?.status).toBe('待审核');
    expect(ningbo?.products).toBe(1);
    expect(ningbo?.orders).toBe(1);
  });

  it('lists provider and project rows for the platform operator', () => {
    const providers = selectProviderRows(demoState, platform);
    expect(providers).toHaveLength(2);
    const projects = selectProjectRows(demoState, platform);
    expect(projects.find((p) => p.id === 'project-nanjing')?.modes).toContain('9810');
    const queue = selectServiceQueue(demoState, platform);
    expect(queue.length).toBeGreaterThan(0);
    const volumes = selectModeVolume(demoState, platform);
    expect(volumes.map((v) => v.mode)).toEqual(expect.arrayContaining(['9810', '9710', '1039']));
  });
});

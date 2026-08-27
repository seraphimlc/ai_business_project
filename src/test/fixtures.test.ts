import { describe, expect, it } from 'vitest';
import { catalogEntries } from '../domain/catalog';
import { demoState } from '../domain/fixtures';
import {
  CANONICAL_STATUSES,
  type ProductLifecycleStatus,
  type SceneRunStatus,
} from '../domain/types';

describe('deterministic fixtures and catalog', () => {
  it('ships the required organizations and business objects', () => {
    expect(demoState.organizations.filter((item) => item.kind === 'platform')).toHaveLength(1);
    expect(demoState.organizations.filter((item) => item.kind === 'enterprise')).toHaveLength(2);
    expect(demoState.organizations.filter((item) => item.kind === 'provider')).toHaveLength(1);
    expect(demoState.products).toHaveLength(1);
    expect(demoState.productAssets.length).toBeGreaterThan(0);
    expect(demoState.leads).toHaveLength(1);
    expect(demoState.complianceCases).toHaveLength(1);
    expect(demoState.inquiries).toHaveLength(1);
    expect(demoState.quotations).toHaveLength(1);
    expect(demoState.orders).toHaveLength(1);
    expect(demoState.tasks.length).toBeGreaterThan(0);
  });

  it('contains exactly 42 Wenzhou and 12 Nanjing source entries', () => {
    expect(catalogEntries.filter((item) => item.projectSource === '温州项目')).toHaveLength(42);
    expect(catalogEntries.filter((item) => item.projectSource === '南京项目')).toHaveLength(12);
  });

  it('does not invent a non-source Wenzhou project name', () => {
    expect(catalogEntries.some((item) => item.originalSourceName === '客户经营分析')).toBe(false);
    expect(catalogEntries.filter((item) => item.originalSourceName === '履约风险预警')).toHaveLength(1);
  });

  it('normalizes every catalog entry to the complete business scenario contract', () => {
    for (const entry of catalogEntries) {
      expect(entry.userVisibleName).not.toContain('AI');
      expect(entry.originalSourceName).toBeTruthy();
      expect(entry.sourceMetadata.originalLabel).toBe(entry.originalSourceName);
      expect(entry.projectSource).toMatch(/温州项目|南京项目|通用产品|外部对接/);
      for (const field of [
        'purpose', 'applicableUsers', 'applicableProjects', 'relatedObjects', 'prerequisites',
        'inputs', 'steps', 'confirmationPoints', 'result', 'writeback', 'taskEffects',
        'notificationEffects', 'exceptionRecovery', 'webEntry', 'miniProgramEntry', 'nextAction',
      ] as const) {
        expect(entry[field]).toBeTruthy();
      }
    }
  });

  it('preserves source mappings and keeps external Nanjing matching out of compliance', () => {
    const externalMatch = catalogEntries.find((item) => item.originalSourceName === '企业出海需求与服务商匹配');
    expect(externalMatch?.projectSource).toBe('南京项目');
    expect(externalMatch?.domain).toBe('服务与物流');
    expect(externalMatch?.sourceMetadata.sourceGroup).toBe('外部系统对接');
    expect(catalogEntries.filter((item) => item.projectSource === '温州项目' && item.domain === '询价与报价').length).toBeGreaterThan(0);
    expect(catalogEntries.some((item) => item.projectSource === '通用产品')).toBe(false);
    expect(catalogEntries.some((item) => item.projectSource === '外部对接')).toBe(false);
    expect(catalogEntries.find((item) => item.originalSourceName === '爆款机会识别')?.sourceMetadata.sourceGroup).toBe('AI 工作台原始场景');
    expect(catalogEntries.find((item) => item.originalSourceName === '企业出海报告')?.sourceMetadata.sourceGroup).toBe('外部系统对接');
    const fulfillmentEntries = catalogEntries.filter((item) => item.originalSourceName === '履约风险预警');
    expect(fulfillmentEntries.map((item) => item.sourceMetadata.sourceGroup)).toEqual(['供应链 SCM 原始场景']);
    expect(catalogEntries.find((item) => item.originalSourceName === '自动生成报价单')?.sourceMetadata.sourceGroup).toBe('AI 工作台原始场景');
  });

  it('uses domain-specific scenario definitions instead of one generic workflow', () => {
    const product = catalogEntries.find((item) => item.domain === '商品建档与内容经营');
    const lead = catalogEntries.find((item) => item.domain === '获客与客户经营');
    const compliance = catalogEntries.find((item) => item.domain === '合规处理');
    expect(product?.inputs).toContain('商品基础信息与素材文件');
    expect(lead?.inputs).toContain('目标市场与采购商线索');
    expect(compliance?.inputs).toContain('合规材料与适用范围');
    expect(product?.steps).not.toEqual(lead?.steps);
    expect(compliance?.confirmationPoints).toContain('确认风险项、整改证据和复核结论');
  });

  it('exports canonical status sets and keeps product lifecycle independent', () => {
    const lifecycle: ProductLifecycleStatus = '草稿';
    const runStatus: SceneRunStatus = '处理中';
    expect(CANONICAL_STATUSES.Product).toContain(lifecycle);
    expect(CANONICAL_STATUSES.SceneRun).toContain(runStatus);
    expect(CANONICAL_STATUSES.Product).not.toContain('内容处理中');
  });

  it('uses stable scoped IDs for every fixture collection', () => {
    for (const records of Object.values(demoState)) {
      if (!Array.isArray(records)) continue;
      const ids = records.map((record) => (record as { id?: string }).id).filter(Boolean);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { hydratePersistedState, STORAGE_KEY, writeInquirySyncCookie, INQUIRY_SYNC_COOKIE } from '../domain/store';
import { demoState } from '../domain/fixtures';
import { domainReducer } from '../domain/reducer';
import type { Actor } from '../domain/types';

const customer: Actor = { userId: 'user-buyer', organizationId: 'org-enterprise-wenzhou', projectIds: ['project-wenzhou'], role: 'customer' };

describe('local demo persistence', () => {
  it('falls back to fixtures and exposes a non-blocking reset notice for corrupt state', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ products: [] }));
    const hydrated = hydratePersistedState();
    expect(hydrated.state.products[0].id).toBe('product-demo');
    expect(hydrated.notice).toContain('本地演示数据');
  });

  it('hydrates a valid serialized state without a notice', () => {
    const valid = hydratePersistedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid.state));
    expect(hydratePersistedState().notice).toBeUndefined();
  });

  it('merges an H5-submitted inquiry from the shared cookie into a fresh state', () => {
    const state = domainReducer(demoState, { type: 'customerSubmitInquiry', actor: customer, inquiryId: 'inquiry-h5-test', summary: '同步测试询价', images: ['a.jpg'], idempotencyKey: 'sync-test-1' });
    expect(() => writeInquirySyncCookie(state)).not.toThrow();
    document.cookie = `${INQUIRY_SYNC_COOKIE}=${encodeURIComponent(JSON.stringify({ inquiries: state.inquiries.filter((i) => i.customerId === 'party-buyer'), sceneRuns: state.sceneRuns, matchResults: state.matchResults, serviceRequests: state.serviceRequests }))}`;
    const hydrated = hydratePersistedState();
    expect(hydrated.notice).toBeUndefined();
    expect(hydrated.state.inquiries.some((item) => item.id === 'inquiry-h5-test')).toBe(true);
    expect(hydrated.state.serviceRequests.some((item) => item.id === 'service-request-inquiry-h5-test')).toBe(true);
  });

  it('rejects malformed records, duplicate IDs, invalid statuses, and broken relationships', () => {
    const valid = hydratePersistedState().state;
    const malformed = structuredClone(valid);
    malformed.products[0].status = 'not-a-product-status' as never;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(malformed));
    expect(hydratePersistedState().notice).toContain('本地演示数据');

    const duplicate = structuredClone(valid);
    duplicate.leads.push({ ...duplicate.leads[0] });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(duplicate));
    expect(hydratePersistedState().notice).toContain('本地演示数据');

    const brokenRelation = structuredClone(valid);
    brokenRelation.productAssets[0].fileAssetId = 'missing-file';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brokenRelation));
    expect(hydratePersistedState().notice).toContain('本地演示数据');

    const crossTenant = structuredClone(valid);
    crossTenant.productAssets[0].productId = 'product-demo';
    crossTenant.productAssets[0].organizationId = 'org-enterprise-nanjing';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(crossTenant));
    expect(hydratePersistedState().notice).toContain('本地演示数据');

    const brokenTarget = structuredClone(valid);
    brokenTarget.sceneRuns[0].targetObject = { type: 'UnknownObject', id: 'product-demo' } as never;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brokenTarget));
    expect(hydratePersistedState().notice).toContain('本地演示数据');

    const brokenSku = structuredClone(valid);
    brokenSku.skus[0].productId = 'missing-product';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brokenSku));
    expect(hydratePersistedState().notice).toContain('本地演示数据');

    const brokenCandidate = structuredClone(valid);
    brokenCandidate.candidates[0].targetObject = { type: 'Lead', id: 'lead-demo' } as never;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brokenCandidate));
    expect(hydratePersistedState().notice).toContain('本地演示数据');

    const wrongProject = structuredClone(valid);
    wrongProject.products[0].projectId = 'project-nanjing';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wrongProject));
    expect(hydratePersistedState().notice).toContain('本地演示数据');
  });
});

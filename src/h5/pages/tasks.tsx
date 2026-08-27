import { useState } from 'react';
import { useDomainStore } from '../../domain/store';
import { selectMyTasks, selectStallCases, selectStallPendingCandidates, selectStallProducts } from '../../domain/selectors';
import { H5Header, StatusBadge, useToast } from '../components';
import { useH5 } from '../context';
import type { H5PageProps } from '../H5App';
import type { DomainAction } from '../../domain/types';

export function TodoList({ navigate }: H5PageProps) {
  const { state, dispatch } = useDomainStore();
  const { actor } = useH5();
  const toast = useToast();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const products = selectStallProducts(state, actor);
  const ownedIds = new Set(products.map((item) => item.id));
  const candidates = selectStallPendingCandidates(state, actor);
  const cases = selectStallCases(state, actor);
  const tasks = selectMyTasks(state, actor).filter((item) => !['已完成', '已取消'].includes(item.status));

  const pendingMaterials = state.complianceMaterials.filter((item) => item.status === '待上传' && cases.some((caseItem) => caseItem.id === item.caseId));

  const uploadMaterial = (materialId: string) => {
    setUploadingId(materialId);
    window.setTimeout(() => {
      dispatch({ type: 'complianceMaterialEvent', actor, materialId, event: 'start_upload', idempotencyKey: `h5-mat-start-${materialId}-${Date.now().toString(36)}` } satisfies DomainAction);
      dispatch({ type: 'complianceMaterialEvent', actor, materialId, event: 'submit', idempotencyKey: `h5-mat-submit-${materialId}-${Date.now().toString(36)}` } satisfies DomainAction);
      setUploadingId(null);
      toast.show('材料已提交');
    }, 1200);
  };

  const confirmCandidate = (candidateId: string) => {
    dispatch({ type: 'confirmCandidate', actor, candidateId, idempotencyKey: `h5-confirm-${candidateId}` } satisfies DomainAction);
    toast.show('已确认');
  };

  const completeTask = (taskId: string) => {
    dispatch({ type: 'completeTask', actor, taskId } satisfies DomainAction);
    toast.show('已完成');
  };

  const items = [
    ...pendingMaterials.map((material) => ({ key: material.id, icon: '📎', title: '补充合规材料', desc: '上传商品合规证明文件', action: <button className="h5-btn primary" disabled={uploadingId === material.id} onClick={() => uploadMaterial(material.id)}>{uploadingId === material.id ? '提交中…' : '上传材料'}</button> })),
    ...candidates.filter((candidate) => ownedIds.has(candidate.targetObject.id)).map((candidate) => ({ key: candidate.id, icon: '✨', title: `确认「${state.products.find((item) => item.id === candidate.targetObject.id)?.name ?? ''}」的新内容`, desc: '内容确认后写回商品', action: <button className="h5-btn primary" onClick={() => confirmCandidate(candidate.id)}>确认</button> })),
    ...tasks.map((task) => ({ key: task.id, icon: '📋', title: task.title, desc: task.objectType, action: <button className="h5-btn primary" onClick={() => completeTask(task.id)}>完成</button> })),
  ];

  return (
    <>
      <H5Header title="待处理" sub={`${items.length} 件事`} back onBack={() => navigate('/home')} />
      <div className="h5-body">
        {items.length === 0 ? (
          <div className="h5-card h5-empty"><i>🎉</i><span>没有需要处理的事<br />去拍个新商品吧</span></div>
        ) : items.map((item) => (
          <div key={item.key} className="h5-card" style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.6rem' }}>{item.icon}</span>
            <div className="h5-row-main"><strong>{item.title}</strong><span>{item.desc}</span></div>
            {item.action}
          </div>
        ))}
        <div className="h5-section" style={{ marginTop: '1rem' }}>
          <button className="h5-btn ghost block" onClick={() => navigate('/products')}>查看我的商品</button>
        </div>
      </div>
    </>
  );
}

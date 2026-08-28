import { useRef, useState } from 'react';
import { useDomainStore } from '../../domain/store';
import { H5Header, H5Section, StatusBadge, categoryEmoji, useToast } from '../components';
import { useH5 } from '../context';
import type { H5PageProps } from '../H5App';
import type { DomainAction } from '../../domain/types';

export function ProductDetail({ id, navigate }: H5PageProps & { id: string }) {
  const { state, dispatch } = useDomainStore();
  const { actor } = useH5();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [activeAsset, setActiveAsset] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const product = state.products.find((item) => item.id === id);
  if (!product || product.ownerId !== actor.userId) {
    return (
      <>
        <H5Header title="商品" back onBack={() => navigate('/products')} />
        <div className="h5-body"><div className="h5-card h5-empty"><i>📦</i><span>商品不存在</span></div></div>
      </>
    );
  }

  const assets = state.productAssets.filter((item) => item.productId === product.id);
  const listing = state.channelListings.find((item) => item.productId === product.id && item.status === '已发布');
  const risk = state.complianceCases.find((item) => item.subjectType === 'Product' && item.subjectId === product.id);
  const openRisk = risk ? state.risks.find((item) => item.caseId === risk.id && !['已解除', '已关闭', '已豁免'].includes(item.status)) : undefined;

  const publish = () => {
    if (product.status === '已停用') { toast.show('已停用商品不能发布'); return; }
    dispatch({ type: 'publishProduct', actor, productId: product.id, idempotencyKey: `h5-pub-${product.id}-${Date.now().toString(36)}` } satisfies DomainAction);
    toast.show('已发布到跨境商城');
  };

  const save = () => {
    const fields: Record<string, unknown> = {};
    if (editName.trim() && editName.trim() !== product.name) fields.name = editName.trim();
    if (editPrice !== '' && Number(editPrice) !== product.price) fields.price = Number(editPrice);
    if (editUnit.trim() && editUnit.trim() !== product.unit) fields.unit = editUnit.trim();
    if (Object.keys(fields).length) {
      dispatch({ type: 'updateProductDraft', actor, productId: product.id, fields, idempotencyKey: `h5-edit-${product.id}-${Date.now().toString(36)}` } satisfies DomainAction);
      toast.show('已保存');
    }
    setEditing(false);
  };

  const currentAsset = assets[Math.min(activeAsset, Math.max(assets.length - 1, 0))];

  const importAsset = (files: FileList | null) => {
    const accepted = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'));
    accepted.forEach((file, index) => {
      const token = `${Date.now().toString(36)}-${index}`;
      dispatch({ type: 'uploadProductAsset', actor, productId: product.id, assetId: `asset-h5-${token}`, fileId: `file-h5-${token}`, name: file.name, kind: 'image', idempotencyKey: `h5-asset-${token}` } satisfies DomainAction);
    });
    if (accepted.length) toast.show(`已导入 ${accepted.length} 张图片到商品素材`);
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <>
      <H5Header title={product.name} back onBack={() => navigate('/products')} sub={listing ? '已发布 · 跨境商城' : '未发布'} />
      <div className="h5-body">
        <div className="h5-section">
          <div className="h5-gallery" style={{ height: 300 }}><i>{categoryEmoji(product.category)}</i></div>
          {assets.length > 1 && (
            <div className="h5-chips" style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
              {assets.map((asset, index) => <button key={asset.id} className={`h5-chip ${activeAsset === index ? 'is-active' : ''}`} onClick={() => setActiveAsset(index)}>{index + 1}</button>)}
            </div>
          )}
          <div className="h5-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {!editing ? (
                <>
                  <div className="h5-detail-price">{product.price !== undefined ? <><strong>¥{product.price}</strong><small>/ {product.unit ?? '件'}</small></> : <strong>未定价</strong>}</div>
                  {listing ? <span className="h5-badge positive">已发布</span> : <StatusBadge status={product.status} />}
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', width: '100%' }}>
                  <div className="h5-field"><label>名称</label><input value={editName} onChange={(event) => setEditName(event.target.value)} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div className="h5-field"><label>价格</label><input type="number" inputMode="decimal" value={editPrice} onChange={(event) => setEditPrice(event.target.value)} /></div>
                    <div className="h5-field"><label>单位</label><input value={editUnit} onChange={(event) => setEditUnit(event.target.value)} /></div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: '0.7rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {!editing ? (
                <>
                  <button className="h5-btn ghost" onClick={() => { setEditing(true); setEditName(product.name); setEditPrice(String(product.price ?? '')); setEditUnit(product.unit ?? '件'); }}>编辑</button>
                  {!listing && <button className="h5-btn primary" onClick={publish}>发布到商城</button>}
                  {listing && <button className="h5-btn ghost" onClick={() => navigate('/products')}>已上架 ✓</button>}
                </>
              ) : (
                <>
                  <button className="h5-btn ghost" onClick={() => setEditing(false)}>取消</button>
                  <button className="h5-btn primary" onClick={save}>保存</button>
                </>
              )}
            </div>
          </div>
        </div>

        <H5Section title="商品素材" note={`${assets.length} 张 · AI 生成图可导入`}>
          <div className="h5-card">
            <div className="h5-upload" style={{ marginBottom: '0.7rem' }}>
              {assets.map((asset) => <div key={asset.id} className="h5-upload-tile" style={{ border: 'none', padding: 0 }}><span style={{ fontSize: '1.6rem' }}>🖼️</span></div>)}
              <button type="button" className="h5-upload-tile" onClick={() => fileInput.current?.click()}><i>＋</i><span>导入图片</span></button>
              <input ref={fileInput} type="file" accept="image/*" multiple capture="environment" style={{ display: 'none' }} onChange={(event) => importAsset(event.target.files)} />
            </div>
            <button className="h5-btn ghost block" onClick={() => navigate('/lkb')}>✨ 去 AI 工作台生成商品图 / 视频</button>
            <p className="h5-footnote">在 AI 工作台生成后保存图片到手机相册，再回到这里点「导入图片」即可写回商品素材。</p>
          </div>
        </H5Section>

        {openRisk && (
          <div className="h5-section">
            <div className="h5-todo-strip" style={{ background: '#fae6e2' }} onClick={() => navigate('/todos')}>
              <span>⚠️</span>
              <span className="h5-row-main"><strong>商品需要处理：{openRisk.title}</strong><small>补交材料后即可恢复正常经营</small></span>
              <span className="h5-capture-arrow">›</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

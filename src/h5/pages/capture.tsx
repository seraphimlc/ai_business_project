import { useRef, useState } from 'react';
import { useDomainStore } from '../../domain/store';
import { H5Header, useToast } from '../components';
import { useH5 } from '../context';
import type { H5PageProps } from '../H5App';
import type { DomainAction } from '../../domain/types';

interface UploadedPhoto { name: string; dataUrl: string; }
interface GeneratedArt { id: string; label: string; emoji: string; gradient: string; }

const ART_GRADIENTS = [
  'linear-gradient(135deg,#f7e6c9,#f3c978)',
  'linear-gradient(135deg,#d9e9f2,#9fc8dd)',
  'linear-gradient(135deg,#ddeee0,#a3cfae)',
  'linear-gradient(135deg,#efe0f0,#c9a6d0)',
];

function readPhotos(files: FileList | null): Promise<UploadedPhoto[]> {
  const accepted = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'));
  return Promise.all(accepted.map((file) => new Promise<UploadedPhoto>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result) });
    reader.onerror = () => resolve({ name: file.name, dataUrl: '' });
    reader.readAsDataURL(file);
  })));
}

export function CaptureFlow({ navigate }: H5PageProps) {
  const { dispatch } = useDomainStore();
  const { actor } = useH5();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [phase, setPhase] = useState<'shoot' | 'generating' | 'pick' | 'info' | 'publishing' | 'done'>('shoot');
  const [arts, setArts] = useState<GeneratedArt[]>([]);
  const [selected, setSelected] = useState<GeneratedArt | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('件');
  const [productId, setProductId] = useState('');

  const startGenerate = () => {
    setPhase('generating');
    window.setTimeout(() => {
      const base = (photo: UploadedPhoto, index: number): GeneratedArt[] => [
        { id: `art-${index}-main`, label: '商品主图', emoji: '🛍️', gradient: ART_GRADIENTS[index % ART_GRADIENTS.length] },
        { id: `art-${index}-scene`, label: '场景图', emoji: '🏠', gradient: ART_GRADIENTS[(index + 1) % ART_GRADIENTS.length] },
        { id: `art-${index}-video`, label: '视频封面', emoji: '🎬', gradient: ART_GRADIENTS[(index + 2) % ART_GRADIENTS.length] },
      ];
      setArts(photos.length ? base(photos[0], 0) : [{ id: 'art-none-main', label: '商品主图', emoji: '🛍️', gradient: ART_GRADIENTS[0] }]);
      setPhase('pick');
    }, 1600);
  };

  const reshuffle = (art: GeneratedArt) => {
    setArts((current) => current.map((item) => item.id === art.id ? { ...item, emoji: ['🛍️', '🏠', '🎬', '🧺', '💡', '🪑'][Math.floor(Math.random() * 6)], gradient: ART_GRADIENTS[Math.floor(Math.random() * ART_GRADIENTS.length)] } : item));
    toast.show('已换一张效果');
  };

  const pickArt = (art: GeneratedArt) => { setSelected(art); setPhase('info'); };

  const createAndPublish = () => {
    const token = Date.now().toString(36);
    const id = `product-h5-${token}`;
    setProductId(id);
    setPhase('publishing');
    const finalName = name.trim() || '我的新商品';
    window.setTimeout(() => {
      dispatch({ type: 'createProductDraft', actor, productId: id, name: finalName } satisfies DomainAction);
      const fields: Record<string, unknown> = { category: '其他' };
      if (price) fields.price = Number(price);
      if (unit) fields.unit = unit;
      dispatch({ type: 'updateProductDraft', actor, productId: id, fields, idempotencyKey: `h5-info-${token}` } satisfies DomainAction);
      photos.forEach((photo, index) => {
        dispatch({ type: 'uploadProductAsset', actor, productId: id, assetId: `asset-h5-orig-${token}-${index}`, fileId: `file-h5-orig-${token}-${index}`, name: photo.name, kind: 'image', idempotencyKey: `h5-orig-${token}-${index}` } satisfies DomainAction);
      });
      arts.forEach((art) => {
        dispatch({ type: 'uploadProductAsset', actor, productId: id, assetId: `asset-h5-${token}-${art.id}`, fileId: `file-h5-${token}-${art.id}`, name: `${art.label}.jpg`, kind: 'image', idempotencyKey: `h5-art-${token}-${art.id}` } satisfies DomainAction);
      });
      dispatch({ type: 'publishProduct', actor, productId: id, idempotencyKey: `h5-publish-${token}` } satisfies DomainAction);
      setPhase('done');
    }, 1400);
  };

  const finish = () => { toast.show('商品已发布'); navigate(`/product/${productId}`); };

  return (
    <>
      <H5Header title="拍照上新" back={phase !== 'shoot'} onBack={() => { if (phase === 'shoot') navigate('/home'); else setPhase('shoot'); }} sub={phase === 'done' ? '完成' : `${['shoot', 'generating'].includes(phase) ? '第一步' : phase === 'pick' ? '第二步' : '第三步'} / 拍照 → 出图 → 发布`} />
      <div className="h5-body">
        {phase === 'shoot' && (
          <div className="h5-card" style={{ padding: '1.4rem' }}>
            <button className="h5-shoot-btn" onClick={() => fileInput.current?.click()}>
              <span className="h5-capture-icon" style={{ fontSize: '4rem' }}>📷</span>
              <strong>拍一张商品照</strong>
              <small>从相册选图也可以，最多 6 张</small>
            </button>
            <input ref={fileInput} type="file" accept="image/*" multiple capture="environment" style={{ display: 'none' }} onChange={async (event) => {
              const next = await readPhotos(event.target.files);
              if (next.length) { setPhotos(next.slice(0, 6)); startGenerate(); }
              event.target.value = '';
            }} />
            {photos.length > 0 && (
              <div className="h5-upload" style={{ marginTop: '1rem' }}>
                {photos.map((photo) => <div key={photo.name} className="h5-upload-tile" style={{ border: 'none', padding: 0 }}>{photo.dataUrl ? <img src={photo.dataUrl} alt={photo.name} /> : <span>📷</span>}</div>)}
              </div>
            )}
          </div>
        )}

        {phase === 'generating' && (
          <div className="h5-card" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
            <div className="h5-spinner">✨</div>
            <strong style={{ display: 'block', fontSize: '1rem', margin: '1rem 0 0.3rem' }}>正在生成商品图…</strong>
            <small style={{ color: 'var(--h5-muted)' }}>自动制作商品主图、场景图和视频封面</small>
          </div>
        )}

        {phase === 'pick' && (
          <>
            <div className="h5-section-title">选一张效果图<small>点「换一张」可重新生成</small></div>
            <div className="h5-art-list">
              {arts.map((art) => (
                <div key={art.id} className="h5-art-card" style={{ background: art.gradient }}>
                  <div className="h5-art-emoji"><i>{art.emoji}</i></div>
                  <span className="h5-art-label">{art.label}</span>
                  <div className="h5-btn-row" style={{ marginTop: 'auto' }}>
                    <button className="h5-btn ghost" style={{ background: 'rgba(255,255,255,0.85)' }} onClick={() => reshuffle(art)}>换一张</button>
                    <button className="h5-btn primary" style={{ background: 'var(--h5-navy)' }} onClick={() => pickArt(art)}>选这张</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="h5-section" style={{ marginTop: '0.9rem' }}>
              <button className="h5-btn ghost block" onClick={() => navigate('/lkb')}>✨ 去 AI 商品内容工作台生成真实效果</button>
              <button className="h5-btn ghost block" style={{ marginTop: '0.5rem' }} onClick={() => fileInput.current?.click()}>📥 从相册导入 AI 生成图</button>
              <p className="h5-footnote">在极创生成商品图 / 场景图 / 视频后保存到相册，再点「从相册导入」即可作为效果图继续发布。</p>
            </div>
          </>
        )}

        {phase === 'info' && selected && (
          <div className="h5-card">
            <div className="h5-art-preview" style={{ background: selected.gradient }}>
              <div className="h5-art-emoji"><i>{selected.emoji}</i></div>
              <span className="h5-art-label">{selected.label}</span>
            </div>
            <div className="h5-field" style={{ marginTop: '1rem' }}>
              <label>商品名称</label>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="我的新商品" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
              <div className="h5-field">
                <label>价格（元）</label>
                <input type="number" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" />
              </div>
              <div className="h5-field">
                <label>单位</label>
                <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="件" />
              </div>
            </div>
            <button className="h5-btn primary block" onClick={createAndPublish}>创建并发布</button>
            <p className="h5-footnote">创建商品并直接发布到跨境商城</p>
          </div>
        )}

        {phase === 'publishing' && (
          <div className="h5-card" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
            <div className="h5-spinner">🚀</div>
            <strong style={{ display: 'block', fontSize: '1rem', margin: '1rem 0 0.3rem' }}>正在发布…</strong>
            <small style={{ color: 'var(--h5-muted)' }}>保存商品并发布到跨境商城</small>
          </div>
        )}

        {phase === 'done' && (
          <div className="h5-card" style={{ padding: '3rem 1.2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem' }}>🎉</div>
            <h2 style={{ font: '1.5rem var(--font-display)', margin: '0.8rem 0 0.3rem' }}>发布成功！</h2>
            <p className="h5-desc" style={{ textAlign: 'center' }}>「{name.trim() || '我的新商品'}」已上架跨境商城，买家马上就能看到。</p>
            <div className="h5-btn-row">
              <button className="h5-btn ghost" onClick={() => navigate('/capture')}>再拍一个</button>
              <button className="h5-btn primary" onClick={finish}>查看商品</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

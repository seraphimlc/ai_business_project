import { useDomainStore } from '../../domain/store';
import type { DomainState } from '../../domain/types';

export function MiniProgramPreview({ navigate }: { navigate: (route: string) => void }) {
  const { state } = useDomainStore(); return <div className="page-stack"><div className="page-intro"><div><span className="eyebrow">跨端预览 / 微信小程序</span><h1>移动端负责发起与接续</h1><p>档口业主和卖家在手机上快速拍摄、上传、确认和跟进，复杂业务处理回到 Web 工作台。</p></div><button type="button" onClick={() => navigate('/product')}>打开 Web 商品工作台 →</button></div><MiniFrame state={state} navigate={navigate} /></div>;
}

function MiniFrame({ state, navigate }: { state: DomainState; navigate: (route: string) => void }) {
  const product = state.products[0]; const candidate = state.candidates.find((item) => item.targetObject.type === 'Product' && item.targetObject.id === product.id && item.status === '待确认');
  return <div className="mobile-preview"><div className="phone-screen"><div className="phone-notch" /><div className="phone-head"><span>9:41</span><b>商品工作台</b><span>•••</span></div><div className="phone-greeting"><small>林负责人，今天</small><h2>{candidate ? '有 1 件工作' : '商品已经更新'}<br />等你确认</h2></div><div className="phone-card"><span>商品经营 · {product.status}</span><strong>{product.name}</strong><p>{candidate ? '商品描述已准备好，等待确认正式版本' : `正式版本 ${product.currentVersion} 已更新`}</p><button type="button" onClick={() => navigate('/product/product-demo')}>{candidate ? '去 Web 完成处理 →' : '查看商品结果 →'}</button></div><div className="phone-card phone-card-light"><span>快捷发起</span><div className="phone-actions"><b>拍摄商品</b><b>上传素材</b><b>查看线索</b></div></div><div className="phone-tab"><span>首页</span><span>工作</span><span>数据</span><span>我的</span></div></div></div>;
}

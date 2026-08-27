import type { PropsWithChildren } from 'react';

const nav = [['/', '工作台'], ['/product', '商品管理'], ['/leads', '客户与线索'], ['/quotation', '询价与报价'], ['/compliance', '合规处理'], ['/order', '订单与履约'], ['/lkb', 'AI 内容工作台']] as const;

export function AppShell({ children, route, navigate, onReset }: PropsWithChildren<{ route: string; navigate: (route: string) => void; onReset: () => void }>) {
  return <div className="app-flush">
    <div className="app-bar">
      <span className="app-brand">跨境业务 · 入驻企业</span>
      <nav className="app-bar-nav">{nav.map(([href, label]) => <button key={href} className={route === href || (href !== '/' && route.startsWith(`${href}/`)) ? 'is-active' : ''} onClick={() => navigate(href)}>{label}</button>)}</nav>
      <span className="app-bar-right"><a href="https://h5.visitworld.me" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>H5 档口业主端 ↗</a><span className="app-bar-divider" /><span>林负责人</span><button className="app-bar-reset" onClick={onReset}>重置演示</button></span>
    </div>
    <main className={route === '/lkb' ? 'main-content-flush' : 'main-content-app'}>{children}</main>
  </div>;
}

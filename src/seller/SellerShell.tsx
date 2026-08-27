import type { PropsWithChildren } from 'react';

const nav = [['/', 'AI 工具'], ['/lkb', 'AI 生图生视频'], ['/listing', '生成 Listing'], ['/sourcing', '选品分析'], ['/compliance', '合规助手'], ['/ads', '广告助手']] as const;

export function SellerShell({ children, route, navigate, onReset }: PropsWithChildren<{ route: string; navigate: (route: string) => void; onReset: () => void }>) {
  return <div className="app-flush">
    <div className="app-bar">
      <span className="app-brand">跨境卖家 · AI 工具</span>
      <nav className="app-bar-nav">{nav.map(([href, label]) => <button key={href} className={route === href || (href !== '/' && route.startsWith(`${href}/`)) ? 'is-active' : ''} onClick={() => navigate(href)}>{label}</button>)}</nav>
      <span className="app-bar-right"><a href="https://h5.visitworld.me" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>H5 档口业主端 ↗</a><span className="app-bar-divider" /><span>王卖家</span><button className="app-bar-reset" onClick={onReset}>重置演示</button></span>
    </div>
    <main className={route === '/lkb' ? 'main-content-flush' : 'main-content-app'}>{children}</main>
  </div>;
}

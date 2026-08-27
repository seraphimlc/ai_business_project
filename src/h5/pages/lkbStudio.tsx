import { H5Header } from '../components';
import type { H5PageProps } from '../H5App';

export const LKB_STUDIO_URL = 'https://lkb-agent.demo.xyb2b.com/studio/video-replicate';

export function LkbStudio({ navigate }: H5PageProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <H5Header
        title="AI 商品内容工作台"
        sub="生图 / 生视频"
        back
        onBack={() => navigate('/home')}
        action={<a className="h5-header-action" href={LKB_STUDIO_URL} target="_blank" rel="noreferrer">全屏 ↗</a>}
      />
      <div style={{ flex: 1, position: 'relative' }}>
        <iframe
          title="AI 商品内容工作台"
          src={LKB_STUDIO_URL}
          style={{ border: 0, height: '100%', width: '100%' }}
          allow="camera; microphone"
        />
      </div>
    </div>
  );
}

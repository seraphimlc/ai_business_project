import { FlowPage } from './FlowPage';
export function OrderFlow({ navigate }: { navigate: (route: string) => void }) { return <FlowPage kind="order" navigate={navigate} />; }

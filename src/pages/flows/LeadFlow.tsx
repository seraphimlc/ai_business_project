import { FlowPage } from './FlowPage';
export function LeadFlow({ navigate }: { navigate: (route: string) => void }) { return <FlowPage kind="lead" navigate={navigate} />; }

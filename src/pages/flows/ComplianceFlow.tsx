import { FlowPage } from './FlowPage';
export function ComplianceFlow({ navigate }: { navigate: (route: string) => void }) { return <FlowPage kind="compliance" navigate={navigate} />; }

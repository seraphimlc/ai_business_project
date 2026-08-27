import { FlowPage } from './FlowPage';
export function QuotationFlow({ navigate }: { navigate: (route: string) => void }) { return <FlowPage kind="quotation" navigate={navigate} />; }

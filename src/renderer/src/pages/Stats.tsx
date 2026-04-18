import type { T } from '../i18n';
interface StatsProps {
  t: T;
}
export default function Stats({ t: _t }: StatsProps): React.JSX.Element {
  return <div className="page-content" />;
}

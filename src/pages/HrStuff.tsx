import { Loading } from '../components/ui';
import { useData } from '../lib/data';
import { ProductPage } from './ProductPage';

/** Team › HR Stuff: the HR projects, shown here instead of under Products. */
export function HrStuff() {
  const { ready, ws } = useData();
  if (!ready) return <Loading />;
  const hr = ws.products.find((p) => p.kind === 'team') ?? ws.products.find((p) => p.name === 'HR Stuffs');
  return <ProductPage productId={hr?.id ?? 'none'} crumb={{ to: '/hr', label: 'Team' }} />;
}

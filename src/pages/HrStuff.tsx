import { Loading } from '../components/ui';
import { useData, useIndex } from '../lib/data';
import { ProductPage } from './ProductPage';

/** Team › HR Stuff: the HR projects, shown here instead of under Products. */
export function HrStuff() {
  const { ready } = useData();
  const ix = useIndex();
  if (!ready) return <Loading />;
  return <ProductPage productId={ix.team?.id ?? 'none'} crumb={{ to: '/hr', label: 'Team' }} />;
}

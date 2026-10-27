'use client';

import { usePathname } from 'next/navigation';
import GalaxyBackdrop from '@/components/galaxy-backdrop';

// One GPU-backed canvas for the authenticated workspace. Unlike per-page canvas
// mounts, this persists when moving between the personal and company modules.
const prefixes=[
  '/mon-compte','/entreprises','/finance-globale','/z-alliance',
  '/tableau-de-bord','/sites','/membres','/clients','/offres',
  '/commandes','/tickets','/personnalisation-tickets','/paiements',
  '/parametres-paiement','/portail','/caisse'
];
export default function WorkspaceBackdrop(){
  const pathname=usePathname();
  const workspace=prefixes.some(prefix=>pathname===prefix||pathname.startsWith(prefix+'/'));
  return workspace?<GalaxyBackdrop/>:null;
}

import type { Metadata } from 'next';
import StudioClient from './StudioClient';

export const metadata: Metadata = {
  title: 'Studio de carte — HALO',
};

// Studio de design de carte du marchand (Agent A). La garde d'accès est posée
// par le layout dashboard (session + redirection admin sans impersonation) ;
// les données passent par /api/merchant/card-design (tenant résolu serveur).
export default function StudioPage() {
  return <StudioClient />;
}

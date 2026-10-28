'use client';

import { useState } from 'react';
import { ZarayIcon, type ZarayIconName } from '@/components/ui/zaray-icon';

type Device = 'desktop' | 'tablet' | 'mobile';
type Scene = 'pilotage' | 'clients' | 'wifi' | 'finance';

const devices: { id: Device; label: string; icon: ZarayIconName }[] = [
  { id: 'desktop', label: 'Ordinateur', icon: 'dashboard' },
  { id: 'tablet', label: 'Tablette', icon: 'site' },
  { id: 'mobile', label: 'Mobile', icon: 'profile' },
];
const scenes: { id: Scene; label: string; icon: ZarayIconName; title: string; description: string; features: string[] }[] = [
  { id: 'pilotage', label: 'Pilotage', icon: 'dashboard', title: 'Vue d’ensemble', description: 'Une vision unifiée de vos activités et de vos sites.', features: ['Entreprises', 'Sites', 'Équipes'] },
  { id: 'clients', label: 'Clients', icon: 'customers', title: 'Relation client', description: 'Le suivi des clients, des offres et des commandes.', features: ['Clients', 'Offres Internet', 'Commandes'] },
  { id: 'wifi', label: 'Tickets Wi-Fi', icon: 'ticket', title: 'Espace tickets', description: 'Génération, historique et personnalisation au même endroit.', features: ['Génération', 'Historique', 'Personnalisation'] },
  { id: 'finance', label: 'Finance', icon: 'payment', title: 'Suivi financier', description: 'Caisse, règlements et justificatifs selon vos autorisations.', features: ['Caisse', 'Paiements', 'Reçus'] },
];

/** Conceptual interface tour: labels are real modules; no synthetic business data. */
export default function PremiumExperience() {
  const [device, setDevice] = useState<Device>('desktop');
  const [scene, setScene] = useState<Scene>('pilotage');
  const active = scenes.find(item => item.id === scene)!;
  const DeviceIcon = devices.find(item => item.id === device)!.icon;

  return <div className="experience-root" aria-label="Découverte interactive de l’interface ZARAY">
    <div className="experience-head">
      <div className="experience-caption"><span className="experience-live-dot" aria-hidden="true" /> EXPLORER ZARAY <span className="experience-caption-divider">/</span> INTERFACE CONCEPTUELLE</div>
      <div className="experience-devices" role="group" aria-label="Choisir la présentation par appareil">
        {devices.map(item => <button type="button" key={item.id}
          className={'experience-device' + (device === item.id ? ' is-active' : '')}
          aria-pressed={device === item.id} onClick={() => setDevice(item.id)}>
          <ZarayIcon name={item.icon} size={15} /><span>{item.label}</span>
        </button>)}
      </div>
    </div>
    <div className="experience-scene-tabs" role="group" aria-label="Explorer les modules">
      {scenes.map(item => <button type="button" key={item.id}
        className={'experience-scene-tab' + (scene === item.id ? ' is-active' : '')}
        aria-pressed={scene === item.id} onClick={() => setScene(item.id)}>
        <ZarayIcon name={item.icon} size={16} /><span>{item.label}</span>
      </button>)}
    </div>
    <div className={'experience-device-frame experience-device-' + device} key={device}>
      <div className="experience-device-chrome" aria-hidden="true"><span /><span /><span /><span className="experience-chrome-title"><ZarayIcon name={DeviceIcon} size={12}/> ZARAY EXPERIENCE</span></div>
      <div className="experience-product-ui">
        <aside className="experience-rail" aria-label="Navigation illustrative">
          <div className="experience-logo-symbol">Z<span>.</span></div>
          {scenes.map(item => <div key={item.id} className={'experience-rail-icon' + (scene === item.id ? ' selected' : '')}><ZarayIcon name={item.icon} size={18}/></div>)}
          <div className="experience-rail-bottom"><ZarayIcon name="settings" size={17}/></div>
        </aside>
        <div className="experience-workspace" key={scene}>
          <div className="experience-workspace-top">
            <span><span className="experience-workspace-indicator" /> MON ESPACE <span aria-hidden="true">/</span> ENTREPRISE</span>
            <span className="experience-workspace-shield"><ZarayIcon name="permissions" size={14}/> ACCÈS CONTRÔLÉ</span>
          </div>
          <div className="experience-workspace-header">
            <div><p>MODULE ZARAY <span>·</span> {active.label.toUpperCase()}</p><h3>{active.title}</h3><span className="experience-workspace-subtitle">{active.description}</span></div>
            <div className="experience-workspace-glyph"><ZarayIcon name={active.icon} size={27}/></div>
          </div>
          <div className="experience-modules">
            {active.features.map((label,index) => <div className="experience-module" key={label}>
              <div className="experience-module-top"><span className="experience-module-index">0{index+1}</span><ZarayIcon name={active.icon} size={16}/></div>
              <strong>{label}</strong><div className="experience-module-line"/><div className="experience-module-line short"/>
            </div>)}
          </div>
          <div className="experience-flow" aria-hidden="true">
            <span>ESPACE PERSONNEL</span><span className="experience-flow-line" /><span>ENTREPRISE</span><span className="experience-flow-line" /><span>MODULES</span>
          </div>
          <div className="experience-mobile-tabs" aria-hidden="true">
            {scenes.map(item => <span className={scene === item.id ? 'active' : ''} key={item.id}><ZarayIcon name={item.icon} size={18}/><small>{item.label}</small></span>)}
          </div>
        </div>
      </div>
    </div>
    <p className="experience-disclaimer">Présentation interactive des espaces · Aucun chiffre ni client fictif · Les données de votre entreprise restent privées.</p>
  </div>;
}

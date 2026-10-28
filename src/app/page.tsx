import { ZarayIcon } from '@/components/ui/zaray-icon';
import BrandLogo from '@/components/brand-logo';
import PremiumExperience from '@/components/premium-experience';
import ThemeSwitch from '@/components/theme-switch';

const features = [
  { tag: 'ORGANISATION', number: '01', icon: 'company', title: 'Entreprises et sites', description: 'Retrouvez vos entreprises dans votre compte personnel et consultez les opérations de chacun de leurs sites.' },
  { tag: 'RELATION CLIENT', number: '02', icon: 'customers', title: 'Gestion des clients', description: 'Centralisez les dossiers clients, les coordonnées et les rattachements aux sites concernés.' },
  { tag: 'CATALOGUE', number: '03', icon: 'wifi', title: 'Offres Internet', description: 'Définissez les offres, leurs durées, tarifs, validités et nombre d’appareils autorisés.' },
  { tag: 'ACTIVITÉ', number: '04', icon: 'orders', title: 'Commandes', description: 'Suivez les souscriptions, leurs statuts et les informations utiles au traitement des demandes.' },
  { tag: 'ACCÈS WI-FI', number: '05', icon: 'ticket', title: 'Tickets Wi-Fi', description: 'Générez et suivez les tickets des clients occasionnels. L’accès réseau dépend de la configuration effective des équipements.' },
  { tag: 'FINANCE', number: '06', icon: 'payment', title: 'Paiements', description: 'Suivez les règlements, les justificatifs et les validations effectuées par les responsables autorisés.' },
  { tag: 'PILOTAGE', number: '07', icon: 'dashboard', title: 'Tableaux de bord', description: 'Consultez les données réelles de votre entreprise ou d’un site, sans indicateurs de démonstration.' },
];
const benefits = [
  { title: 'Chaque information à sa place', description: 'Le compte personnel, l’entreprise et les sites sont clairement séparés. Les données restent dans le bon contexte.' },
  { title: 'Une activité plus facile à suivre', description: 'Clients, offres, commandes et paiements se retrouvent dans un même espace de gestion.' },
  { title: 'Des décisions fondées sur des données réelles', description: 'Les tableaux de bord présentent les informations enregistrées ; les éléments indisponibles ne sont pas inventés.' },
];

export default function HomePage() {
  return <div className="landing">
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <a href="/" className="landing-brand" aria-label="ZARAY — accueil"><BrandLogo priority /></a>
        <nav className="landing-navigation" aria-label="Navigation publique">
          <a href="#fonctionnalites"><ZarayIcon name="dashboard" size={18} /> Fonctionnalités</a>
          <a href="#fonctionnement"><ZarayIcon name="settings" size={18} /> Fonctionnement</a>
          <a href="#avantages"><ZarayIcon name="confirm" size={18} /> Avantages</a>
        </nav>
        <div className="landing-header-actions">
          <ThemeSwitch />
          <a href="/connexion" className="landing-header-login"><ZarayIcon name="login" size={18} /> Se connecter</a>
          <a href="/inscription" className="landing-button landing-button-primary landing-header-signup"><ZarayIcon name="signup" size={18} /> Créer un compte</a>
        </div>
      </div>
    </header>
    <main id="contenu">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-kicker"><span aria-hidden="true" className="landing-kicker-dot"/> ZARAY · THE FUTURE OF BUSINESS EXPERIENCE</p>
            <h1 id="landing-title">Pilotez votre activité Wi-Fi. <span data-contrast-ignore>Entrez dans une nouvelle dimension.</span></h1>
            <p className="landing-hero-description">Un espace de pilotage vivant pour vos entreprises, vos sites, vos clients, vos offres Internet, vos commandes, vos tickets Wi-Fi et vos paiements. Une expérience avancée, ancrée dans vos opérations réelles.</p>
            <div className="landing-hero-actions">
              <a href="/inscription" className="landing-button landing-button-primary"><ZarayIcon name="signup" size={18} /> Créer un compte</a>
              <a href="/connexion" className="landing-button landing-button-outline"><ZarayIcon name="login" size={18} /> Se connecter</a>
            </div>
            <p className="landing-hero-note">Un compte personnel pour accéder aux entreprises auxquelles vous êtes autorisé.</p>
          </div>
          <PremiumExperience />
        </div>
      </section>
      <section className="landing-summary" aria-label="Les principes de ZARAY">
        <div className="landing-container landing-summary-inner">
          <p><span aria-hidden="true">✓</span> Un compte, plusieurs entreprises accessibles</p>
          <p><span aria-hidden="true">✓</span> Vue globale et vues par site</p>
          <p><span aria-hidden="true">✓</span> Accès selon les rôles</p>
        </div>
      </section>
      <section className="landing-section" id="fonctionnalites" aria-labelledby="landing-features-title">
        <div className="landing-container">
          <div className="landing-section-intro"><p className="landing-label">LES FONCTIONNALITÉS</p>
            <div className="landing-section-title-row"><h2 id="landing-features-title">Une plateforme organisée autour de vos opérations.</h2><p>Des outils concrets pour gérer votre activité Wi-Fi, de la structure de l’entreprise jusqu’au suivi des clients et des règlements.</p></div>
          </div>
          <div className="landing-feature-grid">{features.map(feature => <article className="landing-feature" key={feature.number}>
            <div className="landing-feature-top"><span>{feature.tag}</span><span>{feature.number}</span></div>
            <h3><ZarayIcon name={feature.icon as import("@/components/ui/zaray-icon").ZarayIconName} size={23} /> {feature.title}</h3><p>{feature.description}</p>
          </article>)}</div>
        </div>
      </section>
      <section className="landing-section landing-section-soft" id="fonctionnement" aria-labelledby="landing-process-title">
        <div className="landing-container">
          <div className="landing-section-intro"><p className="landing-label">COMMENT ÇA MARCHE</p>
            <div className="landing-section-title-row"><h2 id="landing-process-title">Une structure simple, même avec plusieurs sites.</h2><p>À chaque niveau, ZARAY vous présente l’espace approprié : votre compte, l’entreprise sélectionnée ou un site particulier.</p></div>
          </div>
          <div className="landing-step-grid">
            <article><span className="landing-step-number">01</span><h3>Créez votre compte</h3><p>Disposez d’un accès personnel, distinct des entreprises que vous gérez.</p></article>
            <article><span className="landing-step-number">02</span><h3>Choisissez votre entreprise</h3><p>Créez votre organisation ou ouvrez une entreprise à laquelle votre compte donne accès.</p></article>
            <article><span className="landing-step-number">03</span><h3>Gérez chaque site</h3><p>Retrouvez les activités et les modules de gestion dans le bon périmètre.</p></article>
          </div>
        </div>
      </section>
      <section className="landing-section" id="avantages" aria-labelledby="landing-benefits-title">
        <div className="landing-container landing-benefits">
          <div className="landing-benefits-lead"><p className="landing-label">POUR VOTRE ACTIVITÉ</p><h2 id="landing-benefits-title">Gardez le fil de vos opérations, site après site.</h2><p>ZARAY rapproche les informations utiles à la gestion quotidienne, sans confondre les entreprises, les équipes ou les points de service.</p></div>
          <div className="landing-benefits-list">{benefits.map((item,index) => <article key={item.title}><span className="landing-benefit-index">0{index + 1}</span><div><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div>
        </div>
      </section>
      <section className="landing-final" aria-labelledby="landing-final-title">
        <div className="landing-container landing-final-inner">
          <div><p className="landing-label">COMMENCER AVEC ZARAY</p><h2 id="landing-final-title">Donnez une structure claire à votre activité Wi-Fi.</h2><p>Créez votre compte, organisez vos entreprises et retrouvez vos opérations dans un espace commun.</p></div>
          <div className="landing-final-actions"><a href="/inscription" className="landing-button landing-button-primary"><ZarayIcon name="signup" size={18} /> Créer un compte</a><a href="/connexion" className="landing-button landing-button-outline"><ZarayIcon name="next" size={18} /> J’ai déjà un compte</a></div>
        </div>
      </section>
    </main>
    <footer className="landing-footer">
      <div className="landing-container landing-footer-inner"><div><a href="/" className="landing-footer-brand" aria-label="ZARAY — accueil"><BrandLogo /></a><p>Plateforme de gestion des activités et des réseaux Wi-Fi.</p></div>
        <nav aria-label="Navigation de pied de page"><a href="#fonctionnalites"><ZarayIcon name="login" size={18} /> Fonctionnalités</a><a href="#fonctionnement"><ZarayIcon name="signup" size={18} /> Fonctionnement</a><a href="/connexion"><ZarayIcon name="signup" size={18} /> Se connecter</a><a href="/inscription"><ZarayIcon name="signup" size={18} /> Créer un compte</a></nav>
      </div>
      <div className="landing-container landing-footer-bottom"><span>© {new Date().getFullYear()} ZARAY</span><span>Gestion multi-entreprises et multi-sites.</span></div>
    </footer>
  </div>;
}

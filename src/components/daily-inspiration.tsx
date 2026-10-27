'use client';

import { useEffect, useState } from 'react';

// Original ZARAY editorial lines: no historical quote or author attribution is claimed.
export const dailyInspirationQuotes = [
  "La régularité transforme les ambitions en résultats.",
  "Une décision courageuse aujourd’hui peut ouvrir les portes de demain.",
  "Avancer avec méthode vaut mieux que courir sans direction.",
  "Une entreprise solide se construit avec de petites promesses tenues.",
  "Chaque difficulté révèle une compétence à développer.",
  "La confiance se gagne par la qualité de chaque engagement.",
  "L’innovation commence souvent par une meilleure question.",
  "Le progrès durable naît d’une discipline discrète.",
  "Les grands projets avancent grâce aux actions ordinaires répétées.",
  "Un bon dirigeant sait écouter avant de décider.",
  "Le succès se prépare longtemps avant de devenir visible.",
  "Un objectif clair donne du sens aux efforts quotidiens.",
  "L’adaptabilité est une force quand le chemin change.",
  "Construire utile exige autant de patience que d’audace.",
  "Une équipe grandit lorsque chacun peut contribuer.",
  "Le temps investi avec intention devient un avantage.",
  "Les solutions simples peuvent produire de grands changements.",
  "Chaque client satisfait raconte la qualité de votre travail.",
  "La curiosité d’aujourd’hui prépare les idées de demain.",
  "Prendre soin des détails, c’est respecter la vision d’ensemble.",
  "Une stratégie efficace commence par une priorité assumée.",
  "Les résultats durables reposent sur des habitudes fiables.",
  "Oser commencer est déjà une forme de leadership.",
  "La valeur créée compte davantage que le bruit produit.",
  "Un échec analysé peut devenir un point de départ.",
  "Choisir l’essentiel libère de l’énergie pour agir.",
  "La vision éclaire la route, la constance permet de l’emprunter.",
  "Chaque échange professionnel peut devenir une occasion d’apprendre.",
  "Un projet avance mieux lorsque ses responsabilités sont claires.",
  "L’excellence naît du soin apporté au travail invisible.",
  "La créativité grandit lorsque l’on observe vraiment les besoins.",
  "Apprendre vite aide à décider avec davantage de justesse.",
  "La confiance de demain dépend des actes d’aujourd’hui.",
  "Faire mieux chaque semaine suffit à changer une trajectoire.",
  "Une ambition partagée peut réunir des talents différents.",
  "L’entrepreneur avance en transformant les contraintes en questions utiles.",
  "Les bonnes décisions protègent aussi le temps des autres.",
  "Un engagement tenu vaut souvent plus qu’un long discours.",
  "Les idées prennent de la valeur lorsqu’elles rencontrent l’action.",
  "Le leadership se mesure aussi à la place laissée aux autres.",
  "Une meilleure organisation ouvre la voie à de nouvelles possibilités.",
  "Le courage n’efface pas l’incertitude, il permet d’agir avec elle.",
  "Chaque étape franchie mérite une nouvelle exigence de qualité.",
  "Faire simple demande parfois plus de réflexion que faire compliqué.",
  "Un regard neuf peut révéler une opportunité longtemps ignorée.",
  "Les projets qui durent respectent leurs ressources.",
  "Développer ses compétences, c’est élargir ses choix.",
  "La réussite collective se construit avec de la confiance réciproque.",
  "Une bonne journée commence par une action qui compte.",
  "Les décisions utiles rapprochent les moyens de la mission.",
  "Le savoir partagé peut multiplier l’impact d’une équipe.",
  "L’ambition devient crédible lorsqu’elle rencontre la rigueur.",
  "Une entreprise progresse quand elle apprend de ses clients.",
  "Les défis ne définissent pas la limite d’un projet.",
  "Un plan imparfait mis en œuvre peut éclairer le prochain pas.",
  "Le changement prend forme lorsque l’on cesse de remettre l’essentiel.",
  "La qualité d’un service se voit dans l’attention portée aux personnes.",
  "Chaque réussite commence par une responsabilité acceptée.",
  "La persévérance devient précieuse lorsqu’elle reste ouverte aux ajustements.",
  "Construire l’avenir, c’est aussi prendre soin des relations d’aujourd’hui."
] as const;

/** Local calendar date (not UTC), consistent through all refreshes of the same day. */
export function localDayIndex(now: Date): number {
  const calendarDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  return ((calendarDay % dailyInspirationQuotes.length) + dailyInspirationQuotes.length) % dailyInspirationQuotes.length;
}

export default function DailyInspiration() {
  const [quoteIndex, setQuoteIndex] = useState<number | null>(null);

  useEffect(() => {
    const syncLocalDate = () => setQuoteIndex(localDayIndex(new Date()));
    syncLocalDate();
    const interval = window.setInterval(syncLocalDate, 60_000);
    document.addEventListener('visibilitychange', syncLocalDate);
    window.addEventListener('focus', syncLocalDate);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', syncLocalDate);
      window.removeEventListener('focus', syncLocalDate);
    };
  }, []);

  return <div className="personal-home-quote-zone">
    {quoteIndex !== null && <figure className="personal-home-inspiration" key={quoteIndex}>
      <blockquote className="personal-home-quote">« {dailyInspirationQuotes[quoteIndex]} »</blockquote>
      <figcaption className="personal-home-quote-author">Pensée originale · ZARAY</figcaption>
    </figure>}
  </div>;
}

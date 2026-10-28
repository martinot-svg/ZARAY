/**
 * Editorially reviewed ZARAY daily inspirations.
 *
 * Every entry carries a source URL and verifiable attribution.
 * Historical citations are marked as French translations/adaptations, never
 * falsely presented as original French verbatim text. Oral traditions are
 * attributed to documented cultures, not invented individual authors.
 * "Loi de l'attraction" is identified as a philosophical/spiritual belief,
 * not as a scientifically established law.
 */
export const quoteCategories = [
  'entrepreneuriat',
  'sagesse-africaine',
  'attraction-etat-esprit',
  'discipline-reussite',
] as const;

export type QuoteCategory = typeof quoteCategories[number];
export type CuratedQuote = {
  id: string;
  category: QuoteCategory;
  content: string;
  author: string;
  kind: 'proverb' | 'citation';
  country: string | null;
  culture: string | null;
  principle: string | null;
  sourceTitle: string;
  sourceUrl: string;
  provenance: string;
  language: 'fr';
  translatedFrom: 'en' | null;
};

const afr2004 = 'https://afriprov.tangaza.ac.ke/2004-african-proverb-of-the-month/';
const afr2006 = 'https://afriprov.tangaza.ac.ke/2006-african-proverb-of-the-month/';
const allen = 'https://www.gutenberg.org/files/4507/4507-h/4507-h.htm';
const wattles = 'https://www.gutenberg.org/files/59844/59844-h/59844-h.htm';
const washington = 'https://www.gutenberg.org/files/2376/2376-h/2376-h.htm';
const douglass = 'https://home.nps.gov/frdo/learn/historyculture/thoughts-for-all-time.htm';
const roosevelt = 'https://www.gutenberg.org/cache/epub/58821/pg58821-images.html';
const shinn = 'https://www.gutenberg.org/cache/epub/74878/pg74878-images.html';
const atkinson = 'https://us.macmillan.com/books/9781250888136/thelawofattraction/';

function proverb(
  id: string, content: string, country: string, culture: string,
  sourceTitle: string, sourceUrl: string,
): CuratedQuote {
  return {
    id, content, country, culture,
    author: `Tradition ${culture}`,
    category: 'sagesse-africaine',
    kind: 'proverb', principle: null, sourceTitle, sourceUrl,
    provenance: 'Proverbe traditionnel documenté pour cette culture ; adaptation française. Auteur individuel inconnu. Le pays indique la tradition attestée, pas nécessairement une origine exclusive.',
    language: 'fr', translatedFrom: null,
  };
}

function cited(
  id: string, category: Exclude<QuoteCategory, 'sagesse-africaine'>,
  content: string, author: string, sourceTitle: string,
  sourceUrl: string, principle: string | null = null,
): CuratedQuote {
  return {
    id, category, content, author, sourceTitle, sourceUrl,
    kind: 'citation', country: null, culture: null, principle,
    provenance: "Adaptation française fidèle d’un passage attribuable à l’auteur dans l’ouvrage ou le discours cité ; ce n’est pas une citation française mot pour mot.",
    language: 'fr', translatedFrom: 'en',
  };
}

export const curatedQuotes: CuratedQuote[] = [
  // Proverbs documented by African Proverbs, Sayings and Stories.
  proverb('af-01','L’union fait la force.','Ouganda','Ganda','Proverbe Ganda, décembre 2006',afr2006),
  proverb('af-02','La souffrance précède parfois la réussite.','Tanzanie','Chagga','Proverbe Chagga, juin 2006',afr2006),
  proverb('af-03','Une personne sage sait écouter les conseils.','Kenya','Gikuyu','Proverbe Gikuyu, avril 2021',
    'https://afriprov.tangaza.ac.ke/april-2021-a-wise-person-is-the-one-who-listens-to-counsel-gikuyu-kenya-proverb/'),
  proverb('af-04','Qui refuse les conseils des anciens marchera jusqu’au coucher du soleil.','Kenya et Tanzanie','Kuria','Proverbe Kuria, avril 2004',
    'https://afriprov.tangaza.ac.ke/apr2004/'),
  proverb('af-05','Il vaut mieux donner que recevoir.','Madagascar','Malagasy','Proverbe employé à Madagascar, novembre 2004',
    'https://afriprov.tangaza.ac.ke/nov2004/'),
  proverb('af-06','Un cheval impétueux exige une bride à sa mesure.','Nigeria','Hausa','Proverbe Hausa, décembre 2004',afr2004),
  proverb('af-07','Les yeux d’une personne sage savent voir au-delà des apparences.','Tanzanie','Haya','Proverbe Haya, août 2004',afr2004),
  proverb('af-08','Fais ton travail avec sérieux : courir après un lièvre en riant, c’est risquer de le perdre.','Tanzanie','Sumbwa','Recueil de proverbes Sumbwa, février 2004',
    'https://afriprov.tangaza.ac.ke/2004-weekly-african-proverbs/'),
  proverb('af-09','Mieux vaut recevoir les félicitations pour son travail que rester dans l’inaction.','Ghana','Ga','Ga and Dangme Proverbs — Joshua N. Kudadjie',
    'https://afriprov.tangaza.ac.ke/ga-and-dangme-ghana-proverbs/'),
  proverb('af-10','Avec beaucoup de patience, on peut même cuire une pierre.','Bénin, Burkina Faso, Cameroun, Mali, Niger, Nigeria, Tchad, Togo et autres pays','Fulfulde','Proverbe Fulfulde, décembre 2005',
    'https://afriprov.tangaza.ac.ke/patience-can-cook-a-stoneq-fulfulde-benin-burkina-faso-cameroon-central-african-republic-chad-mali-niger-nigeria-sudan-and-togo/'),

  // Entrepreneurship: grounded in the named authors' actual works.
  cited('en-01','entrepreneuriat','Pour bâtir la prospérité, la pensée doit se prolonger par des actes concrets.','Wallace D. Wattles','The Science of Getting Rich — chap. XI',wattles),
  cited('en-02','entrepreneuriat','Crée davantage de valeur pour les autres que le prix qu’ils te versent.','Wallace D. Wattles','The Science of Getting Rich — chap. XI',wattles),
  cited('en-03','entrepreneuriat','Fixe une vision claire de ce que tu veux construire, puis agis dans sa direction.','Wallace D. Wattles','The Science of Getting Rich — chap. XI',wattles),
  cited('en-04','entrepreneuriat','L’initiative personnelle compte autant que la force de ses ambitions.','Wallace D. Wattles','The Science of Getting Rich — chap. XI',wattles),
  cited('en-05','entrepreneuriat','Le succès ne se mesure pas seulement à la position atteinte, mais aux obstacles traversés.','Booker T. Washington','Up from Slavery — chap. II',washington),
  cited('en-06','entrepreneuriat','Valorise le travail quotidien par tes compétences et ton intelligence.','Booker T. Washington','Up from Slavery — discours d’Atlanta',washington),
  cited('en-07','entrepreneuriat','Un projet ne vaut que par les actions qui transforment son intention en réalité.','James Allen','As a Man Thinketh — Thought-Factor in Achievement',allen),
  cited('en-08','entrepreneuriat','Ne recherche pas seulement un résultat : développe les qualités qui te permettront de le mériter.','James Allen','As a Man Thinketh — Thought-Factor in Achievement',allen),

  // Personal discipline and success: identifiable, historical authors.
  cited('di-01','discipline-reussite','Sans effort ni lutte, il n’y a pas de progrès.','Frederick Douglass','West India Emancipation — discours de 1857',douglass),
  cited('di-02','discipline-reussite','Les grandes avancées demandent d’accepter l’effort plutôt que d’attendre des conditions parfaites.','Frederick Douglass','West India Emancipation — discours de 1857',douglass),
  cited('di-03','discipline-reussite','Aucune réussite durable ne remplace le travail opiniâtre.','Booker T. Washington','Up from Slavery',washington),
  cited('di-04','discipline-reussite','Le chemin parcouru face aux difficultés est une véritable mesure de la réussite.','Booker T. Washington','Up from Slavery — chap. II',washington),
  cited('di-05','discipline-reussite','Mieux vaut tenter de grandes choses, même au risque d’échouer, que de ne rien entreprendre.','Theodore Roosevelt','The Strenuous Life — discours de 1899',roosevelt),
  cited('di-06','discipline-reussite','La volonté dirigée et la maîtrise de soi donnent leur force aux accomplissements.','James Allen','As a Man Thinketh — Thought-Factor in Achievement',allen),
  cited('di-07','discipline-reussite','Les habitudes se construisent avec les pensées que l’on entretient et les actions que l’on répète.','James Allen','As a Man Thinketh — Effect of Thought on Circumstances',allen),
  cited('di-08','discipline-reussite','Pour atteindre de grandes réalisations, il faut accepter de grands efforts.','James Allen','As a Man Thinketh — Thought-Factor in Achievement',allen),

  // New Thought / law-of-attraction writings. Label as philosophy, NOT science.
  cited('at-01','attraction-etat-esprit','L’attention portée à une idée oriente la manière de percevoir et de poursuivre ses objectifs.','William Walker Atkinson','Thought Vibration — The Law of Attraction in the Thought World',atkinson,
    'Loi de l’attraction — courant New Thought (croyance, non loi scientifique)'),
  cited('at-02','attraction-etat-esprit','Ce que nous souhaitons ou craignons occupe une place importante dans nos pensées.','William Walker Atkinson','Thought Vibration — The Law of Attraction in the Thought World',atkinson,
    'Loi de l’attraction — formulation de William Walker Atkinson (1906)'),
  cited('at-03','attraction-etat-esprit','Cultive tes visions et tes idéaux plutôt que de les abandonner.','James Allen','As a Man Thinketh — Visions and Ideals',allen,
    'Visualisation et idéaux — philosophie du développement personnel'),
  cited('at-04','attraction-etat-esprit','L’esprit est comparable à un jardin : il faut choisir ce que l’on y cultive.','James Allen','As a Man Thinketh — Effect of Thought on Circumstances',allen,
    'Culture des pensées — philosophie de James Allen'),
  cited('at-05','attraction-etat-esprit','Les pensées, les habitudes et les actes se renforcent au fil du temps.','James Allen','As a Man Thinketh — Effect of Thought on Circumstances',allen,
    'Pensée et habitudes — conception philosophique de James Allen'),
  cited('at-06','attraction-etat-esprit','Une image mentale claire a besoin d’être accompagnée d’une action concrète.','Wallace D. Wattles','The Science of Getting Rich — chap. XI',wattles,
    'Visualisation et action — courant New Thought (non loi scientifique)'),
  cited('at-07','attraction-etat-esprit','La parole et l’état d’esprit peuvent influencer la façon dont on aborde sa vie.','Florence Scovel Shinn','The Game of Life and How to Play It — The Power of the Word',shinn,
    'Pouvoir des affirmations — croyance spirituelle de Florence Scovel Shinn'),
  cited('at-08','attraction-etat-esprit','Formule des affirmations qui résonnent sincèrement avec tes convictions.','Florence Scovel Shinn','The Game of Life and How to Play It — Denials and Affirmations',shinn,
    'Affirmations positives — croyance spirituelle de Florence Scovel Shinn'),
];

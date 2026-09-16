/**
 * The platform's own knowledge base — what SOFICLEF and this application *are*, as opposed
 * to what is in their database rows.
 *
 * Every other retriever answers from records: a position, a document, a training module. None
 * of them can answer "what is this platform for", "what does ISO 9001 mean here", "how is the
 * company organised" or "what is a cellule" — those facts are not rows, they are context. A
 * model asked them falls through to the ungrounded path and answers from general knowledge,
 * which is exactly where a confident invention about SOFICLEF comes from.
 *
 * So they live here, as curated entries with the same shape the retrievers produce. They are
 * static and version-controlled rather than database rows on purpose: this is editorial
 * content about the product and the company, it changes with a release rather than with a
 * user's action, and a reviewer should see it change in a diff.
 *
 * Adding an entry: give it a stable `id`, keywords in French, English **and** Arabic, and a
 * `detail` that reads as a complete answer on its own — it may be shown verbatim when no
 * language model is configured.
 *
 * The three languages are not optional. Retrieval is lexical: it strips accents and lowercases
 * but it does not translate, so a question in Arabic can only reach a French entry through an
 * Arabic keyword written here. The UI ships in those three languages, so the keywords do too.
 */

/**
 * @typedef {object} KnowledgeEntry
 * @property {string} id          stable identifier, also the citation key
 * @property {string} titleFr     short label, shown as the source chip
 * @property {string[]} keywords  extra match terms beyond the title and detail text
 * @property {string} detail      the answer text itself
 * @property {string} [href]      where the reader can see this for themselves
 */

/** @type {KnowledgeEntry[]} */
export const KNOWLEDGE = [
  /* ---------------------------------------------------------------- the company */
  {
    id: 'societe-identite',
    titleFr: 'SOFICLEF — identité',
    keywords: [
      'soficlef', 'societe', 'entreprise', 'company', 'sarl', 'qui sommes nous',
      'presentation', 'about', 'activite', 'metier', 'serrurerie', 'cles', 'serrures',
      'سوفيكليف', 'الشركة', 'مؤسسة', 'نشاط', 'أقفال', 'مفاتيح',
    ],
    detail:
      "SOFICLEF est une SARL algérienne spécialisée dans les solutions d'ouverture et de fermeture : serrures, clés, portes, plaques et quincaillerie. L'entreprise a été fondée en 1994 et son siège se trouve à Si Mustapha, wilaya de Boumerdès. Elle est certifiée ISO 9001:2015 et reconnue Opérateur Économique Agréé (OEA).",
    href: '/entreprise',
  },
  {
    id: 'societe-site',
    titleFr: 'Site de production',
    keywords: [
      'site', 'usine', 'atelier', 'entrepot', 'warehouse', 'boumerdes', 'si mustapha',
      'adresse', 'address', 'localisation', 'ou', 'where', 'surface', 'm2', 'factory', 'plant',
      'الموقع', 'المصنع', 'العنوان', 'بومرداس', 'أين', 'ورشة', 'مستودع',
    ],
    detail:
      "Le site industriel de SOFICLEF est implanté à Si Mustapha (wilaya de Boumerdès, Algérie) et comprend environ 15 000 m² d'entrepôt et d'ateliers de production.",
    href: '/entreprise',
  },
  {
    id: 'societe-certifications',
    titleFr: 'Certifications',
    keywords: [
      'certification', 'iso', 'iso 9001', '9001', 'qualite', 'quality', 'oea', 'aeo',
      'operateur economique agree', 'norme', 'standard', 'smq', 'certified',
      'شهادة', 'شهادات', 'الشهادات', 'الجودة', 'إيزو', 'ايزو', 'معيار', 'المعايير', 'اعتماد',
    ],
    detail:
      "SOFICLEF est certifiée ISO 9001:2015 pour son Système de Management de la Qualité (SMQ) et détient le statut d'Opérateur Économique Agréé (OEA / AEO). Le SMQ est piloté par la Cellule Audit et Management Qualité, rattachée directement à la Direction Générale.",
    href: '/qms',
  },

  /* ----------------------------------------------------------- the organisation */
  {
    id: 'organisation-structure',
    titleFr: 'Organigramme — comment il est structuré',
    keywords: [
      'organigramme', 'organisation', 'org chart', 'structure', 'hierarchie', 'hierarchy',
      'direction', 'directions', 'cellule', 'cellules', 'niveaux', 'levels', 'departments',
      'الهيكل', 'التنظيمي', 'المديريات', 'الأقسام', 'تنظيم',
    ],
    detail:
      "L'organigramme de SOFICLEF compte quatre niveaux. La Direction Générale est au sommet. Huit directions lui sont rattachées : Finances et Comptabilité, Commerciale, Achats, Marketing et Stratégie, Production, Logistique, Ressources Humaines — plus la Direction Générale elle-même. Chaque direction regroupe des structures (unités opérationnelles) et des cellules (unités fonctionnelles transverses). Trois entités sont rattachées directement à la Direction Générale : la Cellule Systèmes d'Informations, la Cellule Audit et Management Qualité, et la Structure Hygiène, Sécurité et Environnement.",
    href: '/organigramme',
  },
  {
    id: 'organisation-vocabulaire',
    titleFr: 'Direction, structure, cellule — le vocabulaire',
    keywords: [
      'direction', 'structure', 'cellule', 'unite', 'vocabulaire', 'difference',
      'signifie', 'veut dire', 'definition', 'what is', 'meaning', 'type', 'unit', 'cell',
      'يعني', 'تعريف', 'الفرق', 'وحدة', 'خلية', 'مصطلح',
    ],
    detail:
      "Trois types d'entités composent l'organigramme. Une « direction » est un grand domaine de responsabilité placé sous un directeur et rattaché à la Direction Générale. Une « structure » est une unité opérationnelle à l'intérieur d'une direction (par exemple Structure Fabrication, Structure Trésorerie). Une « cellule » est une unité fonctionnelle plus petite, souvent transverse, comme la Cellule Audit et Management Qualité ou la Cellule Administration des Ventes.",
    href: '/organigramme',
  },
  {
    id: 'organisation-production',
    titleFr: 'Direction Production',
    keywords: [
      'production', 'fabrication', 'maintenance', 'controle qualite', 'atelier',
      'etudes', 'methodes', 'manufacturing',
      'الإنتاج', 'التصنيع', 'الصيانة', 'مراقبة',
    ],
    detail:
      "La Direction Production regroupe quatre entités : la Structure Fabrication, la Structure Maintenance, la Structure Contrôle Qualité et la Cellule Études & Méthodes. C'est la direction la plus documentée de la plateforme : procédures PR-01-PRO (fabrication), PR-02-PRO (contrôle qualité) et PR-04-PRO (retours non conformes / SAV).",
    href: '/organigramme',
  },

  /* ------------------------------------------------------------- the platform */
  {
    id: 'plateforme-role',
    titleFr: 'À quoi sert cette plateforme',
    keywords: [
      'plateforme', 'platform', 'application', 'app', 'site', 'outil', 'sert',
      'utilite', 'pourquoi', 'why', 'what for', 'fonctionnalites', 'features',
      'المنصة', 'التطبيق', 'الموقع', 'أداة', 'لماذا', 'وظائف', 'استخدام',
    ],
    detail:
      "Cette plateforme est l'outil RH interne de SOFICLEF. Elle réunit l'organigramme de l'entreprise, les fiches de poste, le référentiel de compétences, la bibliothèque documentaire, le catalogue de formation, les parcours d'intégration des nouveaux arrivants et les campagnes d'évaluation. Chacun y accède à ce que son rôle et son périmètre autorisent.",
    href: '/app',
  },
  {
    id: 'plateforme-assistant',
    titleFr: "Comment fonctionne l'assistant",
    keywords: [
      'assistant', 'ia', 'ai', 'intelligence artificielle', 'chatbot', 'bot', 'agent',
      'agents', 'comment ca marche', 'how does it work', 'fiable', 'source', 'sources',
      'المساعد', 'الذكاء', 'الاصطناعي', 'روبوت', 'مصادر', 'كيف',
    ],
    detail:
      "L'assistant répond uniquement à partir des données que vous êtes déjà autorisé à consulter : il cherche d'abord dans la plateforme, puis un modèle de langage reformule ce qui a été trouvé. Il cite toujours ses sources. Quand rien ne correspond, il le dit plutôt que d'inventer. Cinq agents se partagent le travail : Accueil (à qui s'adresser), Documents, Parcours d'intégration, Formation et Compétences.",
    href: '/app/me/assistant',
  },
  {
    id: 'plateforme-roles',
    titleFr: 'Les rôles et ce qu’ils donnent',
    keywords: [
      'role', 'roles', 'permission', 'permissions', 'droits', 'acces', 'access',
      'admin', 'rh', 'hr', 'manager', 'employe', 'employee', 'perimetre', 'scope',
      'دور', 'أدوار', 'صلاحيات', 'حقوق', 'وصول', 'مدير', 'موظف', 'الموارد',
    ],
    detail:
      "La plateforme distingue quatre rôles. L'Administrateur gère les comptes, les rôles et le paramétrage. Les Ressources Humaines voient l'ensemble des collaborateurs, les parcours et les campagnes. Un Manager voit son équipe et la branche de l'organigramme sous son poste. Un collaborateur voit son propre parcours, ses formations, ses compétences et la partie de l'organigramme autour de son poste.",
    href: '/app',
  },
  {
    id: 'plateforme-compte',
    titleFr: 'Obtenir un accès',
    keywords: [
      'compte', 'account', 'acces', 'login', 'connexion', 'mot de passe', 'password',
      'identifiants', 'credentials', 'inscription', 'demande', 'en attente', 'pending',
      'حساب', 'دخول', 'كلمة', 'المرور', 'تسجيل', 'انتظار',
    ],
    detail:
      "Les comptes ne sont pas auto-créés : le service informatique crée le compte, puis les Ressources Humaines l'affectent à un poste. Tant qu'aucun poste n'est affecté, le compte reste « en attente d'affectation » et l'accès est limité. Pour un problème d'accès ou de mot de passe, adressez-vous aux Ressources Humaines ou à la Cellule Systèmes d'Informations.",
    href: '/login',
  },

  /* ------------------------------------------------------------ HR processes */
  {
    id: 'processus-integration',
    titleFr: "Le parcours d'intégration",
    keywords: [
      'integration', 'onboarding', 'parcours', 'nouveau', 'nouvelle', 'arrivant',
      'checklist', 'etapes', 'jalons', 'milestone', 'premier jour', 'first day',
      'periode essai', 'probation', 'essai',
      'الإدماج', 'مسار', 'جديد', 'مراحل', 'قائمة', 'التجربة',
    ],
    detail:
      "Chaque nouvel arrivant se voit attribuer un parcours d'intégration : une suite de jalons datés (accueil, remise du matériel, formations obligatoires, points d'étape) que le collaborateur et son manager suivent depuis la plateforme. L'avancement est visible dans « Mon parcours », et les tâches en retard y sont signalées. La période d'essai fait l'objet d'un suivi distinct côté Ressources Humaines.",
    href: '/app/me/journey',
  },
  {
    id: 'processus-formation',
    titleFr: 'Les formations obligatoires',
    keywords: [
      'formation', 'formations', 'training', 'module', 'modules', 'obligatoire',
      'mandatory', 'quiz', 'score', 'seuil', 'certificat', 'certificate', 'reussite',
      // Arabic inflects with prefixes *and* suffixes, and the matcher is lexical: الدورات
      // ("the courses") neither equals nor contains دورة ("course"), so the definite and
      // plural forms are listed explicitly rather than hoped for.
      'تكوين', 'التكوين', 'التكوينية', 'تدريب', 'التدريب', 'دورة', 'دورات', 'الدورات',
      'إجباري', 'الإجبارية', 'اجباري', 'اختبار', 'شهادة', 'نجاح', 'وحدات',
    ],
    detail:
      "Le catalogue comporte cinq modules obligatoires : Hygiène, Sécurité et Environnement (seuil 80 %), Système de Management de la Qualité ISO 9001:2015 (75 %), Règlement intérieur (70 %), Sécurité informatique (75 %) et Politique RH et vie du collaborateur (70 %). Chaque module se valide par un quiz ; le seuil de réussite est propre au module et un certificat est délivré une fois le module validé.",
    href: '/app/me/training',
  },
  {
    id: 'processus-competences',
    titleFr: 'Le référentiel de compétences',
    keywords: [
      'competence', 'competences', 'skill', 'skills', 'referentiel', 'matrice',
      'matrix', 'niveau', 'level', 'ecart', 'gap', 'evaluation', 'fiche de poste',
      'job description', 'poste',
      'كفاءات', 'الكفاءات', 'كفاءة', 'مهارات', 'المهارات', 'مستوى', 'المستوى', 'فجوة',
      'تقييم', 'التقييم', 'منصب', 'المنصب', 'وظيفة', 'الوظيفة', 'المطلوبة',
    ],
    detail:
      "Chaque poste porte une fiche de poste et une matrice de compétences : pour chaque compétence attendue, un niveau requis et le caractère obligatoire ou optionnel. Comparée à vos évaluations, la matrice fait apparaître votre écart — conforme, à développer, ou écart critique. C'est cette comparaison qui alimente les besoins de formation.",
    href: '/competencies',
  },
  {
    id: 'processus-documents',
    titleFr: 'La bibliothèque documentaire',
    keywords: [
      'document', 'documents', 'bibliotheque', 'library', 'procedure', 'procedures',
      'reglement', 'politique', 'policy', 'telecharger', 'download', 'pdf', 'fichier',
      // English terms for the same things. The document retriever matches French row titles,
      // so an English question ("internal regulations", "company rules") finds no document at
      // all; landing here instead points the reader at the library rather than at nothing.
      'regulation', 'regulations', 'rules', 'internal', 'handbook', 'file', 'files', 'find',
      'وثائق', 'الوثائق', 'وثيقة', 'مكتبة', 'المكتبة', 'إجراء', 'إجراءات', 'الإجراءات',
      'نظام', 'النظام', 'داخلي', 'الداخلي', 'لائحة', 'اللائحة', 'تحميل', 'ملف', 'أجد',
    ],
    detail:
      "La bibliothèque documentaire réunit les documents de référence de l'entreprise : règlement intérieur, procédures qualité du SMQ, organigrammes, plan de circulation HSE, fiches de poste, documents de stratégie. Certains sont restreints à une direction : vous ne voyez que ceux qui vous sont ouverts. Un document peut être publié mais pas encore déposé — il apparaît alors « en attente de publication ».",
    href: '/documents',
  },
  {
    id: 'processus-contacts',
    titleFr: 'Trouver le bon interlocuteur',
    keywords: [
      'contact', 'contacts', 'annuaire', 'directory', 'telephone', 'poste', 'extension',
      'numero', 'joindre', 'appeler', 'qui contacter', 'who to contact', 'interlocuteur',
      'اتصال', 'دليل', 'هاتف', 'رقم', 'المسؤول', 'من',
    ],
    detail:
      "L'annuaire interne de la plateforme liste les interlocuteurs de référence avec leur rôle et leur numéro de poste : direction commerciale, achats, moyens généraux, parc véhicules, production, assistanat de direction, emploi et compétences, SMQ, HSE et cybersécurité. L'agent « Accueil » de l'assistant cherche dans cet annuaire et dans l'organigramme que vous pouvez voir.",
    href: '/contacts',
  },
  {
    id: 'processus-hse',
    titleFr: 'Hygiène, Sécurité et Environnement',
    keywords: [
      'hse', 'securite', 'safety', 'hygiene', 'environnement', 'environment', 'accident',
      'epi', 'consigne', 'risque', 'atelier', 'circulation', 'incident',
      'السلامة', 'الأمن', 'النظافة', 'البيئة', 'حادث', 'خطر', 'وقاية',
    ],
    detail:
      "La Structure Hygiène, Sécurité et Environnement est rattachée directement à la Direction Générale. Le module de formation HSE est obligatoire et doit être validé (seuil 80 %) avant toute présence en atelier ou en entrepôt. Le plan de circulation HSE du site est disponible dans la bibliothèque documentaire.",
    href: '/hse',
  },
];

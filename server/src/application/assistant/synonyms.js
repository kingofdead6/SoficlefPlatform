/**
 * Cross-language synonyms for the words this platform's content is actually written in.
 *
 * The problem this solves is the one thing that stops a trilingual interface from having a
 * trilingual assistant. The interface switches language; the *content* does not. A contact's
 * role is stored as "Responsable Formation", a document as "Procédure d'accueil", a
 * competency as "Sécurité machine" — in French, because that is how this company writes them
 * and because translating them on the fly would produce labels that appear nowhere on the
 * pages the answer links to.
 *
 * So a reader on the English interface types "who is responsible for training?", the
 * retriever looks for the literal word "training", every stored row says "formation", and the
 * assistant answers "I found nothing" — for a question it has the answer to. That is not a
 * missing translation, it is the assistant being unusable in two of its three languages.
 *
 * Each group below is one concept, written the ways someone here would type it. Matching
 * expands a question's words through these groups, so "training", "formation" and "تكوين" all
 * reach the same rows. Nothing is translated and nothing is displayed from this file: it
 * widens the *search*, and the answer still quotes the row exactly as stored.
 *
 * What belongs here: the working vocabulary of HR, onboarding, quality and safety — the words
 * that appear in position titles, document names and competency labels. What does not: proper
 * nouns, codes, and anything where two of the three languages would not mean the same thing.
 *
 * Written unnormalised, as a person would type them. `matching.js` folds accents, hamza and
 * the Arabic article when it builds its index, so the entries here need not be pre-folded.
 */
export const SYNONYM_GROUPS = [
  // --- people and structure
  ['responsable', 'responsible', 'manager', 'head', 'chef', 'supervisor', 'مسؤول', 'مدير'],
  ['directeur', 'direction', 'director', 'management', 'مديرية', 'إدارة'],
  ['poste', 'position', 'job', 'role', 'منصب', 'وظيفة'],
  ['service', 'department', 'structure', 'unit', 'مصلحة', 'قسم', 'هيكل'],
  ['equipe', 'team', 'فريق'],
  ['collaborateur', 'employee', 'staff', 'employe', 'موظف', 'عامل'],
  ['recrutement', 'recruitment', 'hiring', 'توظيف'],
  ['rh', 'hr', 'الموارد البشرية', 'موارد'],
  ['contact', 'annuaire', 'directory', 'اتصال', 'دليل'],

  // --- documents
  ['document', 'documents', 'file', 'files', 'fichier', 'وثيقة', 'وثائق', 'ملف'],
  ['procedure', 'procedures', 'process', 'processes', 'processus', 'إجراء', 'إجراءات'],
  ['politique', 'policy', 'سياسة'],
  ['formulaire', 'form', 'استمارة'],
  ['reglement', 'regulation', 'rules', 'نظام', 'لائحة'],
  ['modele', 'template', 'نموذج'],

  // --- onboarding and the journey
  ['integration', 'onboarding', 'accueil', 'induction', 'إدماج', 'استقبال'],
  ['parcours', 'journey', 'path', 'مسار'],
  ['tache', 'taches', 'task', 'tasks', 'todo', 'مهمة', 'مهام'],
  ['etape', 'step', 'milestone', 'jalon', 'مرحلة'],
  ['echeance', 'deadline', 'due', 'أجل', 'موعد'],
  ['retard', 'overdue', 'late', 'تأخر', 'متأخرة'],
  ['essai', 'probation', 'trial', 'تجربة'],
  ['checklist', 'liste', 'الفحص'],

  // --- training
  ['formation', 'training', 'trainings', 'course', 'courses', 'تكوين', 'تدريب'],
  ['module', 'modules', 'وحدة'],
  ['quiz', 'test', 'exam', 'examen', 'اختبار'],
  ['score', 'note', 'mark', 'result', 'resultat', 'نتيجة', 'علامة'],
  ['certificat', 'certificate', 'شهادة'],
  ['obligatoire', 'mandatory', 'required', 'إجبارية', 'إلزامي'],

  // --- competencies and evaluation
  ['competence', 'competences', 'competency', 'competencies', 'skill', 'skills', 'كفاءة', 'كفاءات', 'مهارة'],
  ['evaluation', 'assessment', 'appraisal', 'تقييم'],
  ['niveau', 'level', 'مستوى'],
  ['ecart', 'gap', 'فارق', 'فجوة'],
  ['objectif', 'objective', 'target', 'goal', 'هدف'],
  ['entretien', 'interview', 'مقابلة'],

  // --- quality, safety, the shop floor
  ['qualite', 'quality', 'جودة'],
  ['securite', 'safety', 'security', 'سلامة', 'أمن'],
  ['hygiene', 'health', 'sante', 'صحة'],
  ['audit', 'inspection', 'تدقيق'],
  ['certification', 'certified', 'iso', 'اعتماد'],
  ['production', 'fabrication', 'manufacturing', 'إنتاج', 'تصنيع'],
  ['maintenance', 'entretien technique', 'صيانة'],
  ['machine', 'equipement', 'equipment', 'آلة', 'معدات'],
  ['incident', 'accident', 'حادث'],

  // --- the employment relationship
  ['conge', 'conges', 'leave', 'holiday', 'holidays', 'vacation', 'عطلة', 'إجازة'],
  ['absence', 'absent', 'غياب'],
  ['salaire', 'pay', 'salary', 'remuneration', 'أجر', 'راتب'],
  ['contrat', 'contract', 'عقد'],
  ['horaire', 'schedule', 'hours', 'توقيت', 'ساعات'],
  ['demission', 'resignation', 'استقالة'],
];

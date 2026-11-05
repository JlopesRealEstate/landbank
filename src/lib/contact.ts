/** Contato oficial da Land Bank Corp — usado em fichas, apresentações e compartilhamentos. */
export const CONTACT = {
  name: "Junior Lopes",
  role: "Consultor responsável · Land Bank Corp",
  phoneDisplay: "+55 19 99496-0304",
  phoneE164: "5519994960304",
  phoneTel: "+5519994960304",
  email: "junior.lopes@creci.org.br",
  whatsapp: (message: string) => `https://wa.me/5519994960304?text=${encodeURIComponent(message)}`,
  mailto: (subject: string, body: string) =>
    `mailto:junior.lopes@creci.org.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
} as const;

export const PANEL_ADMIN_EMAIL = 'contato.estagiosdf@gmail.com';

export function isPanelAdminEmail(email: string | null | undefined): boolean {
  return email === PANEL_ADMIN_EMAIL;
}

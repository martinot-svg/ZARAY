import type { ComponentProps } from 'react';
import {
  ArrowLeft, ArrowRight, Bell, Check, CircleHelp, Download, Eye, EyeOff,
  House, LayoutDashboard, LogIn, LogOut, Pencil, Plus, Printer, RefreshCw,
  Save, Search, Settings, Trash2, Upload, UserRound, UserRoundPlus, Wallet, X,
  Building2, Users, UsersRound, ChevronDown, PanelLeft, CreditCard, Wifi, Ticket, Receipt, MapPin, KeyRound, Copy, Mail, Menu, ClipboardList, FileText, Router, ShieldCheck, Send, Store,
  type LucideIcon
} from 'lucide-react';

/** ZARAY functional icon registry: single source for labels and actions. */
export const zarayIcons = {
  home: House, close: X, login: LogIn, signup: UserRoundPlus,
  logout: LogOut, sidebar: PanelLeft, dashboard: LayoutDashboard, settings: Settings,
  finance: Wallet, add: Plus, edit: Pencil, delete: Trash2,
  save: Save, search: Search, download: Download, upload: Upload,
  print: Printer, back: ArrowLeft, next: ArrowRight,
  refresh: RefreshCw, confirm: Check, cancel: X,
  show: Eye, hide: EyeOff, notifications: Bell, profile: UserRound,
  help: CircleHelp, expand: ChevronDown,
  company: Building2, alliance: UsersRound, members: Users, customers: Users, wifi: Wifi, ticket: Ticket, receipt: Receipt,
  payment: CreditCard, site: MapPin, password: KeyRound, copy: Copy, email: Mail, menu: Menu,
  orders: ClipboardList, document: FileText, network: Router, permissions: ShieldCheck, send: Send, cash: Store,
} satisfies Record<string, LucideIcon>;

export type ZarayIconName = keyof typeof zarayIcons;
export type ZarayIconProps = Omit<ComponentProps<LucideIcon>, 'name'> & {
  name: ZarayIconName;
};

/** Icons inherit currentColor, so text contrast rules cover them in every theme. */
export function ZarayIcon({ name, size = 20, strokeWidth = 1.9, 'aria-hidden': ariaHidden = true, ...props }: ZarayIconProps) {
  const Icon = zarayIcons[name];
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden} focusable="false" data-zaray-icon="" {...props} />;
}

import {
  Car, FileText, GraduationCap, HandHelping, Home, Laptop, MoreHorizontal, PackageCheck, PawPrint,
  ShoppingBasket, Smartphone, Users, Wrench, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  ShoppingBasket, PackageCheck, PawPrint, Laptop, GraduationCap, Home, Wrench, Users, Car, FileText, Smartphone, MoreHorizontal, HandHelping,
};

export const CATEGORY_ICON_NAMES = Object.keys(ICONS);

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || HandHelping;
  return <Icon className={className ?? "size-5"} aria-hidden />;
}

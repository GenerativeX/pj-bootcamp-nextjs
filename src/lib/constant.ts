export const SITE_METADATA = {
  NAME: "AI coding camp",
  TEMPLATE: "%s | AI coding camp",
  DESCRIPTION: "AI coding camp",
  ICON: "/favicon.ico",
};

import type { IconType } from "react-icons";
import {
  FiMessageSquare,
  FiGlobe,
  FiFileText,
  FiSearch,
  FiGitMerge,
} from "react-icons/fi";

export interface LinkItemProps {
  name: string;
  icon: IconType;
  href: string;
}
export const LinkItems: LinkItemProps[] = [
  { name: "トップ", icon: FiGlobe, href: "/" },
  { name: "AIチャット", icon: FiMessageSquare, href: "/chat" },

  { name: "PDF Reader", icon: FiFileText, href: "/pdf-reader" },
  { name: "Web検索Agent", icon: FiSearch, href: "/web-search-agent" },
  { name: "Payment Flow", icon: FiGitMerge, href: "/payment-flow" },
];

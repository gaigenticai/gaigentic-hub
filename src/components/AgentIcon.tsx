import {
  Shield,
  Calculator,
  Search,
  FileText,
  Brain,
  Target,
  Globe,
  BarChart3,
  TrendingUp,
  Receipt,
  HeartPulse,
  Zap,
  Tag,
  Eye,
  AlertTriangle,
  DollarSign,
  CreditCard,
  Scale,
  Building2,
  Landmark,
  PieChart,
  Activity,
  Briefcase,
  Lock,
  type LucideIcon,
} from "lucide-react";

/**
 * Map of Lucide icon names to components.
 * Builder-created agents store icon names as strings (e.g. "BarChart3").
 * Hand-crafted agents use emoji strings (e.g. "🔍").
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Shield,
  Calculator,
  Search,
  FileText,
  Brain,
  Target,
  Globe,
  BarChart3,
  TrendingUp,
  Receipt,
  HeartPulse,
  Zap,
  Tag,
  Eye,
  AlertTriangle,
  DollarSign,
  CreditCard,
  Scale,
  Building2,
  Landmark,
  PieChart,
  Activity,
  Briefcase,
  Lock,
};

interface AgentIconProps {
  icon: string;
  className?: string;
}

/**
 * Renders an agent icon — either a Lucide icon (by name) or an emoji.
 */
export default function AgentIcon({ icon, className = "w-5 h-5" }: AgentIconProps) {
  const LucideComponent = ICON_MAP[icon];
  if (LucideComponent) {
    return <LucideComponent className={className} />;
  }
  // Emoji or unknown string — render directly
  return <span>{icon}</span>;
}

/**
 * ExplanationCard Component
 * 
 * Informational card explaining the benefits of admin role when creating a family.
 * Displayed above the family creation form to provide context and clarity.
 * 
 * Features:
 * - Static content (no interactivity)
 * - Clean, accessible design
 * - Uses shadcn/ui Card component
 * - Responsive layout
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

/**
 * ExplanationCard - Displays admin role benefits
 * 
 * This card explains what it means to be an admin of the family hub,
 * helping users understand the privileges and responsibilities they'll have.
 * 
 * @example
 * ```tsx
 * <ExplanationCard />
 * ```
 */
export function ExplanationCard() {
  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-blue-900">
          You'll be the admin
        </CardTitle>
        <CardDescription className="text-blue-700">
          As the creator, you'll have full control over your family hub
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3" role="list">
          <AdminBenefitItem text="Generate invitation codes for your family" />
          <AdminBenefitItem text="Manage family settings and members" />
          <AdminBenefitItem text="Full access to all shared content" />
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * AdminBenefitItem - Individual benefit list item
 * 
 * Displays a single benefit with a check icon for visual emphasis.
 * 
 * @param text - The benefit text to display
 */
interface AdminBenefitItemProps {
  text: string;
}

function AdminBenefitItem({ text }: AdminBenefitItemProps) {
  return (
    <li className="flex items-start gap-3">
      <Check 
        className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" 
        aria-hidden="true"
      />
      <span className="text-sm text-blue-900">{text}</span>
    </li>
  );
}

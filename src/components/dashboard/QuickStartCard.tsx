/**
 * QuickStartCard - przykładowa karta w empty state
 * Pokazuje demo wydarzenie i podgląd AI suggestion
 */

import { ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface QuickStartCardProps {
  title: string;
  suggestionPreview: string;
  onTry: (title: string) => void;
}

export function QuickStartCard({
  title,
  suggestionPreview,
  onTry,
}: QuickStartCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowRight className="w-4 h-4" />
          <span>{suggestionPreview}</span>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={() => onTry(title)} className="w-full">
          Try it
        </Button>
      </CardFooter>
    </Card>
  );
}


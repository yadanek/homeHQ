/**
 * EmptyState - pusty stan kalendarza
 * Pokazuje Quick Start Cards z przykładowymi wydarzeniami
 */

import { QuickStartCard } from './QuickStartCard';

interface EmptyStateProps {
  onTryExample: (title?: string) => void;
}

export function EmptyState({ onTryExample }: EmptyStateProps) {
  const examples = [
    {
      title: "jasełka u Ani",
      suggestionPreview: "Przygotować strój dla dziecka na przedstawienie",
    },
    {
      title: "Emma's birthday party",
      suggestionPreview: "Buy birthday cake, Send invitations",
    },
    {
      title: "Weekend trip to the mountains",
      suggestionPreview: "Check hiking equipment, Book accommodation",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-96 p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold mb-2">Your calendar is empty</h2>
        <p className="text-muted-foreground">
          Create your first event and see how HomeHQ suggests tasks automatically
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
        {examples.map((example) => (
          <QuickStartCard
            key={example.title}
            title={example.title}
            suggestionPreview={example.suggestionPreview}
            onTry={onTryExample}
          />
        ))}
      </div>
    </div>
  );
}


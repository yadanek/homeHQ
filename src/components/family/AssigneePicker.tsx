import { useCallback, useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ProfileSummary } from '@/types';

interface AssigneePickerBaseProps {
  label: string;
  description?: string;
  options: ProfileSummary[];
  currentUserId?: string;
  isDisabled?: boolean;
  showRole?: boolean;
}

interface AssigneePickerSingleProps extends AssigneePickerBaseProps {
  selectionMode?: 'single';
  value: string | null;
  onChange: (value: string | null) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

interface AssigneePickerMultiProps extends AssigneePickerBaseProps {
  selectionMode: 'multiple';
  value: string[];
  onChange: (value: string[]) => void;
}

type AssigneePickerProps = AssigneePickerSingleProps | AssigneePickerMultiProps;

export function AssigneePicker(props: AssigneePickerProps) {
  const {
    label,
    description,
    options,
    currentUserId,
    isDisabled = false,
    showRole = false,
  } = props;
  const inputId = useId();
  const descriptionId = `${inputId}-description`;

  const getOptionLabel = useCallback(
    (option: ProfileSummary) => {
      if (option.id === currentUserId) {
        return `${option.display_name} (You)`;
      }
      return option.display_name;
    },
    [currentUserId]
  );

  if (props.selectionMode === 'multiple') {
    const { value, onChange } = props;

    const handleToggle = useCallback(
      (optionId: string) => {
        if (value.includes(optionId)) {
          onChange(value.filter(id => id !== optionId));
          return;
        }
        onChange([...value, optionId]);
      },
      [onChange, value]
    );

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <div className="space-y-2" role="group" aria-describedby={description ? descriptionId : undefined}>
          {options.map(option => (
            <label
              key={option.id}
              className="flex items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors"
            >
              <Checkbox
                checked={value.includes(option.id)}
                onCheckedChange={() => handleToggle(option.id)}
                disabled={isDisabled}
              />
              <span className="flex-1">
                {getOptionLabel(option)}
                {showRole && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({option.role === 'admin' ? 'Adult' : 'Member'})
                  </span>
                )}
              </span>
            </label>
          ))}
          {options.length === 0 && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              No family accounts available yet.
            </div>
          )}
        </div>
      </div>
    );
  }

  const {
    value,
    onChange,
    allowEmpty = true,
    emptyLabel = 'Unassigned',
  } = props;

  const handleSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.target.value;
      onChange(nextValue ? nextValue : null);
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      <select
        id={inputId}
        value={value ?? ''}
        onChange={handleSelectChange}
        disabled={isDisabled}
        aria-describedby={description ? descriptionId : undefined}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

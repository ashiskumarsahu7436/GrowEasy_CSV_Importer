import { Check } from 'lucide-react';
import { STEP_LABELS, type WizardStep } from '@/types';

interface StepIndicatorProps {
  currentStep: WizardStep;
}

const STEPS: WizardStep[] = [1, 2, 3, 4];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
      {STEPS.map((step) => {
        const isDone = step < currentStep;
        const isActive = step === currentStep;
        const isPending = step > currentStep;

        return (
          <div
            key={step}
            className={[
              'rounded-xl border bg-card p-4 shadow-sm transition-all duration-200',
              isActive
                ? 'border-border ring-1 ring-primary'
                : 'border-border opacity-80',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shadow-sm',
                  isDone || isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                  isPending ? 'opacity-70' : '',
                ].join(' ')}
              >
                {isDone ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{step}</span>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Step {step}</p>
                <p className="text-sm font-semibold text-foreground">
                  {STEP_LABELS[step]}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

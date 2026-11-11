import { useId, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/** Mirrors the Figma "Text Input" component with a label above it. */
export function TextInput({ label, error, ...rest }: Props) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="t-caption-emphasis">{label}</label>
      <input id={id} className={`input${error ? ' input-error' : ''}`} {...rest} />
      {error && <span className="field-error t-caption">{error}</span>}
    </div>
  );
}

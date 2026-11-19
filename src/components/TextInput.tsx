import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/**
 * Mirrors the Figma "Text Input" component with a label above it.
 * Password fields get a Show / Hide button so you can check what you typed.
 */
export function TextInput({ label, error, type, ...rest }: Props) {
  const id = useId();
  const isPassword = type === 'password';
  const [shown, setShown] = useState(false);
  const input = <input id={id} type={isPassword && shown ? 'text' : type} className={`input${error ? ' input-error' : ''}`} {...rest} />;
  return (
    <div className="field">
      <label htmlFor={id} className="t-caption-emphasis">{label}</label>
      {isPassword ? (
        <span className="input-reveal">
          {input}
          <button type="button" className="reveal-button" aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}
            aria-controls={id} onClick={() => setShown((s) => !s)}>
            {shown ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      ) : input}
      {error && <span className="field-error t-caption">{error}</span>}
    </div>
  );
}

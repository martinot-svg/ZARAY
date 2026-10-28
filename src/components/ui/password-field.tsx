'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id' | 'name' | 'children'> & {
  label: string;
  name: string;
};

/** Accessible, local-only password visibility. Never stores or transmits the value. */
export default function PasswordField({ label, name, ...inputProps }: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe';

  return (
    <div className="zaray-password-field">
      <label htmlFor={id}>{label}</label>
      <div className="zaray-password-control">
        <input
          {...inputProps}
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
        />
        <button
          type="button"
          className="zaray-password-toggle"
          aria-label={toggleLabel}
          aria-pressed={visible}
          aria-controls={id}
          title={toggleLabel}
          onClick={() => setVisible(value => !value)}
        >
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

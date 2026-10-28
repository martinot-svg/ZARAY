'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { ZarayIcon } from '@/components/ui/zaray-icon';

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
          <ZarayIcon name={visible ? 'hide' : 'show'} size={23} strokeWidth={2.5} aria-hidden={true} />
        </button>
      </div>
    </div>
  );
}

/*==============================================================================
  Password strength.

  Four cells, mark-sheet style. Deliberately NOT a security judgement — the
  server's rule is simply a length minimum, and pretending otherwise would be
  theatre. This is feedback on the shape of what has been typed, and it appears
  only AFTER the first character so an untouched form is not already grading
  anyone.
==============================================================================*/

export interface PasswordStrength {
  /** 0–4, how many cells are filled. */
  score: number;
  /** The word shown beside the cells. */
  label: string;
  /** CSS colour token for the filled cells. */
  colour: string;
}

const MIN_LENGTH = 8;

export function passwordStrength(value: string): PasswordStrength {
  if (!value) {
    return { score: 0, label: '', colour: 'var(--jp-neutral-300)' };
  }

  let score = 0;

  // Length carries the most weight because it is the only thing that actually
  // costs an attacker time.
  if (value.length >= MIN_LENGTH) score += 1;
  if (value.length >= 12) score += 1;

  const classes =
    Number(/[a-z]/.test(value)) +
    Number(/[A-Z]/.test(value)) +
    Number(/\d/.test(value)) +
    Number(/[^A-Za-z0-9]/.test(value));

  if (classes >= 2) score += 1;
  if (classes >= 3) score += 1;

  // Below the server's own minimum nothing else matters — the form is going to
  // reject it regardless, so the meter should not imply otherwise.
  if (value.length < MIN_LENGTH) {
    return { score: 1, label: 'Too short', colour: 'var(--jp-danger)' };
  }

  score = Math.min(score, 4);

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colours = [
    'var(--jp-neutral-300)',
    'var(--jp-danger)',
    'var(--jp-warning)',
    'var(--jp-warning)',
    'var(--jp-success)',
  ];

  return { score, label: labels[score], colour: colours[score] };
}

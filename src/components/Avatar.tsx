const tones = ['--surface-avatar-1', '--surface-avatar-2', '--surface-avatar-3', '--surface-avatar-4', '--surface-avatar-5'];

/** Mirrors the Figma "Avatar" (Type=Initials). Colour is picked from the name so it stays stable. */
export function Avatar({ name, size = 24 }: { name: string; size?: 20 | 24 | 32 }) {
  const tone = tones[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: `var(${tone})`, fontSize: size * 0.5 }} aria-hidden>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

import { useEffect, useState } from 'react';
import { Typography } from '@mui/material';

interface ObfuscatedEmailProps {
  user: string;
  domain: string;
  className?: string;
}

/**
 * Renders a mailto-Link erst nach der JS-Hydration.
 * Im prerenderten HTML ist keine E-Mail-Adresse enthalten —
 * Crawler sehen weder den Linktext noch den mailto:-href.
 */
export default function ObfuscatedEmail({ user, domain, className }: ObfuscatedEmailProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const email = `${user}@${domain}`;
  return (
    <Typography
      component="a"
      href={`mailto:${email}`}
      className={className}
    >
      {email}
    </Typography>
  );
}

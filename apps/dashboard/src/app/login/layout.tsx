import React from 'react';

/**
 * Login layout — renders children without the dashboard sidebar/topbar.
 * This is a minimal wrapper that provides a clean, standalone layout
 * for the authentication flow.
 */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

import { isIP } from 'node:net';
// Errors contain field names and rules only: never echo secrets or connection strings.
export interface RuntimeConfig {
  origin: string;
  cookieSecret: string;
  databaseUrl?: string;
  production?: boolean;
  trustedProxyIp?: string;
}

export function runtimeConfigIssues(config: RuntimeConfig): string[] {
  const issues: string[] = [];
  if (config.cookieSecret.length < 32)
    issues.push('COOKIE_SECRET: se requieren al menos 32 caracteres.');
  if (config.production && /CHANGE_ME|REPLACE_WITH|CAMBIAR/i.test(config.cookieSecret))
    issues.push('COOKIE_SECRET: sustituir el marcador por un secreto aleatorio propio.');
  try {
    const origin = new URL(config.origin);
    if (
      !['http:', 'https:'].includes(origin.protocol) ||
      origin.origin !== config.origin ||
      (config.production && origin.protocol !== 'https:')
    )
      issues.push('APP_ORIGIN: usar un origen exacto sin ruta; HTTPS obligatorio en producción.');
  } catch {
    issues.push('APP_ORIGIN: origen inválido.');
  }
  if (config.trustedProxyIp && !isIP(config.trustedProxyIp))
    issues.push('TRUSTED_PROXY_IP: una dirección IP exacta, sin CIDR ni comodines.');
  if (config.production) {
    try {
      const database = new URL(config.databaseUrl ?? '');
      if (
        !['postgres:', 'postgresql:'].includes(database.protocol) ||
        !database.hostname ||
        !database.username ||
        !database.password ||
        database.pathname.length < 2
      )
        throw new Error();
      if (decodeURIComponent(database.username) !== 'forma_api')
        issues.push('DATABASE_URL: la API debe usar el rol restringido forma_api.');
    } catch {
      issues.push('DATABASE_URL: conexión PostgreSQL explícita obligatoria en producción.');
    }
  }
  return issues;
}

export function proxyTrust(ip: string | undefined) {
  if (!ip) return false;
  if (!isIP(ip)) throw new Error('TRUSTED_PROXY_IP: dirección IP inválida.');
  return (address: string, hop: number) =>
    hop === 0 && (address === ip || address === '::ffff:' + ip);
}

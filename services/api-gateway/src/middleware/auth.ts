import { FastifyRequest, FastifyReply } from 'fastify';
import { HTTP_STATUS } from '@opensalesai/shared';

/**
 * Decoded token payload from Keycloak JWT.
 */
export interface TokenPayload {
  sub: string;
  email: string;
  preferred_username: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: Record<string, { roles: string[] }>;
  tenant_id?: string;
  company_id?: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      user_id: string;
      email: string;
      username: string;
      tenant_id: string;
      company_id: string;
      roles: string[];
    };
  }
}

/**
 * Pre-handler hook that validates JWT bearer tokens.
 * Extracts user_id, tenant_id, company_id, and roles from the token.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
      success: false,
      error: {
        code: 'MISSING_AUTH_HEADER',
        message: 'Authorization header is required',
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
      success: false,
      error: {
        code: 'INVALID_AUTH_FORMAT',
        message: 'Authorization header must use Bearer scheme',
      },
      timestamp: new Date().toISOString(),
    });
  }

  const token = authHeader.slice(7);

  try {
    const payload = (await request.server.jwks.verify(token)) as unknown as TokenPayload;

    const roles: string[] = [];
    if (payload.realm_access?.roles) {
      roles.push(...payload.realm_access.roles);
    }
    const clientId = process.env['KEYCLOAK_CLIENT_ID'] || 'opensalesai-api';
    const resourceRoles = payload.resource_access?.[clientId]?.roles;
    if (resourceRoles) {
      roles.push(...resourceRoles);
    }

    const tenantId = payload.tenant_id || extractTenantFromRoles(roles) || 'default';
    const companyId = payload.company_id || tenantId;

    request.user = {
      user_id: payload.sub,
      email: payload.email || '',
      username: payload.preferred_username || '',
      tenant_id: tenantId,
      company_id: companyId,
      roles,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';

    request.log.warn({ error: errorMessage }, 'JWT verification failed');

    return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token',
      },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Role-based authorization factory.
 * Returns a pre-handler that checks if the user has any of the required roles.
 */
export function requireRoles(...requiredRoles: string[]) {
  return async function roleCheck(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication is required',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const hasRole = requiredRoles.some((role) =>
      request.user.roles.includes(role),
    );

    if (!hasRole) {
      return reply.status(HTTP_STATUS.FORBIDDEN).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Requires one of roles: ${requiredRoles.join(', ')}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Try to extract a tenant identifier from role naming conventions.
 * E.g., role "tenant_abc123_admin" -> tenant_id "abc123"
 */
function extractTenantFromRoles(roles: string[]): string | null {
  for (const role of roles) {
    const match = role.match(/^tenant_([a-zA-Z0-9-]+)_/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

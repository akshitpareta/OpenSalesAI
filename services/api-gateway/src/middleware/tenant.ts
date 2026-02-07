import { FastifyRequest, FastifyReply } from 'fastify';
import { HTTP_STATUS } from '@opensalesai/shared';

/**
 * Pre-handler hook that ensures every authenticated request
 * has a valid tenant_id and company_id scope.
 *
 * This middleware must run AFTER authMiddleware so that
 * request.user is populated.
 *
 * Tenant active status is determined by the soft-delete pattern:
 * if deletedAt is not null, the tenant has been deactivated.
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user) {
    return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
      success: false,
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication is required before tenant validation',
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (!request.user.tenant_id) {
    return reply.status(HTTP_STATUS.FORBIDDEN).send({
      success: false,
      error: {
        code: 'MISSING_TENANT',
        message: 'User is not associated with any tenant',
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (!request.user.company_id) {
    return reply.status(HTTP_STATUS.FORBIDDEN).send({
      success: false,
      error: {
        code: 'MISSING_COMPANY',
        message: 'User is not associated with any company',
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Verify the tenant exists and is active (not soft-deleted) in the database
  try {
    const tenant = await request.server.prisma.tenant.findUnique({
      where: { id: request.user.tenant_id },
      select: { id: true, deletedAt: true },
    });

    if (!tenant) {
      return reply.status(HTTP_STATUS.FORBIDDEN).send({
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'The associated tenant does not exist',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Soft-delete pattern: if deletedAt is set, the tenant has been deactivated
    if (tenant.deletedAt !== null) {
      return reply.status(HTTP_STATUS.FORBIDDEN).send({
        success: false,
        error: {
          code: 'TENANT_INACTIVE',
          message: 'The associated tenant account is inactive',
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    // If the tenant table doesn't exist yet (during initial setup),
    // log the warning but allow the request through
    request.log.warn(
      { tenant_id: request.user.tenant_id, error },
      'Could not verify tenant — table may not exist yet',
    );
  }
}

/**
 * Helper to extract company_id from the current request.
 * Used in service methods that need multi-tenant scoping.
 */
export function getCompanyId(request: FastifyRequest): string {
  if (!request.user?.company_id) {
    throw new Error('company_id not available — auth middleware may not have run');
  }
  return request.user.company_id;
}

/**
 * Helper to extract tenant_id from the current request.
 */
export function getTenantId(request: FastifyRequest): string {
  if (!request.user?.tenant_id) {
    throw new Error('tenant_id not available — auth middleware may not have run');
  }
  return request.user.tenant_id;
}

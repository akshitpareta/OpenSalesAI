import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import * as jose from 'jose';

export interface JWKSConfig {
  issuer: string;
  jwksUri: string;
  audience?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    jwks: {
      verify: (token: string) => Promise<jose.JWTPayload>;
      config: JWKSConfig;
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const keycloakUrl = process.env['KEYCLOAK_URL'] || 'http://localhost:8080';
  const realm = process.env['KEYCLOAK_REALM'] || 'opensalesai';

  const config: JWKSConfig = {
    issuer: `${keycloakUrl}/realms/${realm}`,
    jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
    audience: process.env['KEYCLOAK_CLIENT_ID'] || 'opensalesai-api',
  };

  const jwks = jose.createRemoteJWKSet(new URL(config.jwksUri));

  const verify = async (token: string): Promise<jose.JWTPayload> => {
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: config.issuer,
      audience: config.audience,
    });
    return payload;
  };

  fastify.decorate('jwks', {
    verify,
    config,
  });

  fastify.log.info(
    { issuer: config.issuer },
    'JWKS auth plugin initialized',
  );
};

export default fp(authPlugin, {
  name: 'auth',
});

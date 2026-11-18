import { APP_NAME } from '@ele/domain';

/** `Worlds — Engineering Learning Environment`. With no parts it is the product name alone. */
export const pageTitle = (...parts: string[]): string => [...parts, APP_NAME].join(' — ');

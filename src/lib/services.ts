import { StaticToken } from '@joist/di';
import fs from 'node:fs';

export const ENV = new StaticToken('ENV', () => process.env);
export const FS = new StaticToken('ENV', () => fs);

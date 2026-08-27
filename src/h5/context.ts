import { createContext, useContext } from 'react';
import type { Actor } from '../domain/types';
import { STALL_OWNER_ACTOR } from './actors';

export interface H5ContextValue { role: 'stall-owner'; actor: Actor; }

export const H5Context = createContext<H5ContextValue>({ role: 'stall-owner', actor: STALL_OWNER_ACTOR });

export function useH5(): H5ContextValue {
  return useContext(H5Context);
}

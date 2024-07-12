import { setTimeout } from 'timers/promises';

export const sleep = async (duration: number) => await setTimeout(duration);

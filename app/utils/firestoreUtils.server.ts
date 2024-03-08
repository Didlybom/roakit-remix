import { ActorData, InitiativeData, actorSchema, initiativeSchema } from '~/schemas/schemas';
import { firestore } from '../firebase.server';

export const fetchInitiatives = async (customerId: number | undefined) => {
  const coll = firestore.collection(`customers/${customerId}/initiatives`);
  const docs = await coll.get();
  const initiatives: InitiativeData[] = [];
  docs.forEach(initiative => {
    const data = initiativeSchema.parse(initiative.data());
    initiatives.push({ id: initiative.id, label: data.label });
  });
  return initiatives;
};

export const fetchActors = async (customerId: number | undefined) => {
  const coll = firestore.collection(`customers/${customerId}/actors`);
  const docs = await coll.get();
  const actors: ActorData[] = [];
  docs.forEach(actor => {
    const data = actorSchema.parse(actor.data());
    actors.push({ id: actor.id, name: data.name });
  });
  return actors;
};

export const fetchActorMap = async (customerId: number | undefined) => {
  const coll = firestore.collection(`customers/${customerId}/actors`);
  const docs = await coll.get();
  const actors: Record<ActorData['id'], Omit<ActorData, 'id'>> = {};
  docs.forEach(actor => {
    const data = actorSchema.parse(actor.data());
    actors[actor.id] = { name: data.name };
  });
  return actors;
};

import { InitiativeData, initiativeSchema } from '~/schemas/schemas';
import { firestore } from '../firebase.server';

export const fetchInitiatives = async (customerId: number | undefined) => {
  const initiativesCollection = firestore.collection(`customers/${customerId}/initiatives`);
  const initiativeDocs = await initiativesCollection.get();
  const initiatives: InitiativeData[] = [];
  initiativeDocs.forEach(initiative => {
    const initiativeData = initiativeSchema.parse(initiative.data());
    initiatives.push({ id: initiative.id, label: initiativeData.label });
  });
  return initiatives;
};
